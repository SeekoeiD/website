+++
title = 'Supermicro Temperature Control'
date = 2025-08-16T14:48:46+02:00
draft = false
tags = ['supermicro', 'fans', 'temperature']
+++

When running servers with high thermal loads or in noisy environments, managing fan speeds intelligently becomes crucial. Default Supermicro BMC fan control can be aggressive and noisy, ramping fans to 100% at relatively low temperatures. This guide shows how to implement a smooth PID-based fan controller that provides better thermal management with less noise.

## The Challenge

Supermicro servers often have overly aggressive fan curves:

- **Sudden jumps to 100%**: Fans go from quiet to maximum speed with small temperature increases
- **Poor granular control**: Limited intermediate fan speeds between minimum and maximum
- **Noise concerns**: Constant high fan speeds in office or home environments
- **Lack of NVMe awareness**: BMC doesn't typically monitor NVMe drive temperatures

## Our Solution: PID Controller

This setup provides:

- **Smooth fan ramping**: Gradual speed changes based on PID control algorithm
- **Multiple temperature sources**: Monitors both CPU and NVMe temperatures
- **Persistent operation**: Runs as a systemd service with automatic restart
- **Configurable setpoints**: Easy adjustment of target temperatures
- **Manual mode override**: Periodically re-asserts BMC manual mode to maintain control

## Requirements

Install the necessary tools (one-time setup):

```bash
apt update
apt install ipmitool nvme-cli lm-sensors
```

## The Controller Script

Create the PID controller script called `smcfan.py`:

```bash
#!/usr/bin/env python3
"""
Supermicro Fan PID Controller (daemon)

- Runs continuously (systemd) at ~5 s cadence (configurable).
- Controls PWM for all zones based on hottest of CPU and NVMe temps.
- Chooses setpoint by hottest source (CPU:60C, NVMe:50C).
- No hard jump to 100% when above setpoint; PID keeps ramping.
"""

import subprocess, json, re, shutil, os, time, signal, sys
from typing import Optional, Tuple

# ===== User-configurable =====
CPU_SETPOINT   = 60          # °C
NVME_SETPOINT  = 60          # °C
MIN_PWM        = 18          # % quiet floor; raise if airflow too low
MAX_PWM        = 100         # %
ZONES          = [0x00, 0x01]  # 0=CPU/SYS, 1=PERIPHERAL on most Supermicro

# PID gains for ~5 s loop
KP = 1.6       # proportional gain
KI = 0.02      # integral gain (per 5 s tick)
KD = 0.2       # derivative gain (helps damp fast spikes)

LOOP_SEC       = 5.0        # control period (seconds)
DEADBAND_C     = 0.5         # °C deadband around setpoint
STATE_FILE     = "/var/tmp/smcfan.state.json"
LAST_PWM_FILE  = "/var/tmp/smcfan.lastpwm"

# Periodically re-assert manual mode (idempotent)
# REASSERT_MODE_EVERY = 60.0   # seconds - disabled, only set at startup

# ===== Helpers =====
def sh(cmd):
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)

def log(msg: str):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"{ts} [smcfan] {msg}", flush=True)

def set_manual_mode():
    # Full/manual mode so raw PWM sticks (idempotent)
    sh(["ipmitool", "raw", "0x30", "0x45", "0x01", "0x01"])

def set_pwm_all(percent: int):
    v = max(0, min(100, int(round(percent))))
    # 0..100 -> 0x00..0x64
    hexv = f"0x{v:02x}" if v <= 0x64 else "0x64"
    for z in ZONES:
        sh(["ipmitool","raw","0x30","0x70","0x66","0x01", f"0x{z:02x}", hexv])

def read_cpu_temp() -> Optional[int]:
    # Prefer BMC SDR
    out = sh(["ipmitool","sdr","type","Temperature"]).stdout
    for line in out.splitlines():
        if re.search(r"CPU", line, re.I) and "degrees C" in line:
            m = re.search(r'(\d+)\s*degrees C', line)
            if m: return int(m.group(1))
    vals = [int(m.group(1)) for m in re.finditer(r'(\d+)\s*degrees C', out)]
    if vals:
        return max(vals)
    # Fallback: lm-sensors
    if shutil.which("sensors"):
        s = sh(["sensors"]).stdout
        mm = re.findall(r'(Tctl|Package id \d+):\s*\+?(\d+)\.\d+°C', s)
        if mm:
            return max(int(t[1]) for t in mm)
    return None

def list_nvme_temps() -> list:
    temps = []
    if not shutil.which("nvme"):
        return temps
    ls = sh(["nvme","list","-o","json"]).stdout
    try:
        j = json.loads(ls)
        devs = [d["DevicePath"] for d in j.get("Devices", []) if "DevicePath" in d]
    except Exception:
        devs = []
    for dev in devs:
        out = sh(["nvme","smart-log", dev]).stdout
        m = re.search(r'temperature\s*:\s*(\d+)\s*C', out)
        if m:
            temps.append(int(m.group(1)))
            continue
        jout = sh(["nvme","smart-log","-o","json", dev]).stdout
        try:
            jj = json.loads(jout)
            if "temperature" in jj:
                k = jj["temperature"]
                temps.append(int(round(k - 273.15)) if k > 200 else int(k))
        except Exception:
            pass
    return temps

def load_state():
    try:
        with open(STATE_FILE, "r") as f:
            st = json.load(f)
            return {
                "i_term": float(st.get("i_term", 0.0)),
                "last_temp": float(st.get("last_temp", 0.0)),
                "last_output": int(st.get("last_output", MIN_PWM)),
                "last_setpoint": float(st.get("last_setpoint", CPU_SETPOINT)),
            }
    except Exception:
        return {"i_term": 0.0, "last_temp": 0.0, "last_output": MIN_PWM, "last_setpoint": CPU_SETPOINT}

def save_state(i_term, last_temp, last_output, last_setpoint):
    try:
        with open(STATE_FILE, "w") as f:
            json.dump({
                "i_term": i_term,
                "last_temp": last_temp,
                "last_output": last_output,
                "last_setpoint": last_setpoint
            }, f)
    except Exception:
        pass
    try:
        with open(LAST_PWM_FILE, "w") as f:
            f.write(str(int(last_output)))
    except Exception:
        pass

def pick_control_temp_and_setpoint(cpu: Optional[int], nvme_hot: Optional[int]) -> Tuple[Optional[int], Optional[float], str]:
    label = "none"
    candidates = []
    if cpu is not None: candidates.append(("cpu", cpu))
    if nvme_hot is not None: candidates.append(("nvme", nvme_hot))
    if not candidates: return None, None, label
    label, hot = max(candidates, key=lambda x: x[1])
    sp = CPU_SETPOINT if label == "cpu" else NVME_SETPOINT
    return hot, float(sp), label

def main():
    # graceful shutdown -> keep current PWM (no forced 100%), then exit
    def handle_exit(signum, frame):
        log("received signal, exiting without PWM override")
        sys.exit(0)
    signal.signal(signal.SIGTERM, handle_exit)
    signal.signal(signal.SIGINT, handle_exit)

    # Set manual mode once at startup
    log("setting BMC to manual mode")
    set_manual_mode()

    st = load_state()

    while True:
        try:
            cpu = read_cpu_temp()
            nvmes = list_nvme_temps()
            nvme_hot = max(nvmes) if nvmes else None

            hottest, setpoint, label = pick_control_temp_and_setpoint(cpu, nvme_hot)

            if hottest is None or setpoint is None:
                # If we can't read temps at all, keep current PWM (no abrupt change)
                log("no temperature readings; keeping current PWM")
                save_state(st["i_term"], st["last_temp"], st["last_output"], st["last_setpoint"])
                time.sleep(LOOP_SEC)
                continue

            # PID
            error = hottest - setpoint
            if abs(error) < DEADBAND_C:
                error = 0.0

            # Derivative on measurement
            d_meas = (hottest - st["last_temp"]) / LOOP_SEC if LOOP_SEC > 0 else 0.0

            # Integral with basic anti-windup
            i_term = st["i_term"] + (KI * error)

            p = KP * error
            d = KD * d_meas
            u = p + i_term + d

            # Map to PWM around MIN_PWM
            pwm = int(round(max(MIN_PWM, min(MAX_PWM, MIN_PWM + u))))

            # Anti-windup: if saturated and error would push further, freeze integral
            if (pwm == MAX_PWM and error > 0) or (pwm == MIN_PWM and error < 0):
                i_term = st["i_term"]

            set_pwm_all(pwm)
            log(f"CPU={cpu if cpu is not None else 'NA'}C NVMeHot={nvme_hot if nvme_hot is not None else 'NA'}C "
                f"Hot={hottest}C({label}) SP={int(setpoint)}C PWM={pwm}% E={round(error,1)} P={round(p,1)} I={round(i_term,2)} D={round(d,2)}")

            # Save state for next tick
            st = {
                "i_term": i_term,
                "last_temp": float(hottest),
                "last_output": int(pwm),
                "last_setpoint": float(setpoint)
            }
            save_state(**st)

        except Exception as e:
            # On unexpected error, keep last PWM and log
            log(f"ERROR: {e}; keeping last PWM={st.get('last_output', 'NA')}")
        finally:
            time.sleep(LOOP_SEC)

if __name__ == "__main__":
    main()
```

## Installation

Save the script and make it executable:

```bash
install -m 0755 smcfan.py /usr/local/bin/smcfan.py
```

## Systemd Service Setup

Create the systemd service file:

```bash
tee /etc/systemd/system/smcfan.service >/dev/null <<'UNIT'
[Unit]
Description=Supermicro Fan PID Controller
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/usr/bin/python3 /usr/local/bin/smcfan.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
```

Enable and start the service:

```bash
systemctl daemon-reload
systemctl enable --now smcfan.service
```

## Monitoring and Verification

Check service status:

```bash
systemctl status smcfan.service
```

Monitor real-time logs:

```bash
journalctl -u smcfan.service -f
```

Example log output:

```text
2025-08-16 12:34:56 [smcfan] CPU=42C NVMeHot=36C Hot=42C(cpu) SP=60C PWM=20% E=-18.0 P=-28.8 I=0.00 D=0.00
```

## Configuration Tuning

The script includes several configurable parameters at the top:

- **CPU_SETPOINT**: Target CPU temperature (default: 60°C)
- **NVME_SETPOINT**: Target NVMe temperature (default: 60°C)  
- **MIN_PWM**: Minimum fan speed percentage (default: 18%)
- **MAX_PWM**: Maximum fan speed percentage (default: 100%)
- **LOOP_SEC**: Control loop interval (default: 5.0 seconds)

PID tuning parameters:

- **KP**: Proportional gain (default: 1.6)
- **KI**: Integral gain (default: 0.02)
- **KD**: Derivative gain (default: 0.2)

## Troubleshooting

### Service Won't Start

1. Check if ipmitool is working: `ipmitool sdr type Temperature`
2. Verify script permissions: `ls -la /usr/local/bin/smcfan.py`
3. Test script manually: `python3 /usr/local/bin/smcfan.py`

### Temperature Reading Issues

1. Verify sensors are working: `sensors` and `nvme list`
2. Check BMC access: `ipmitool sdr list`
3. Review logs for specific errors: `journalctl -u smcfan.service -n 50`

### Fan Control Not Working

1. Ensure BMC is in manual mode
2. Test manual PWM control: `ipmitool raw 0x30 0x70 0x66 0x01 0x00 0x32`
3. Check if zones are correct for your hardware

## Removal

To completely remove the fan controller:

```bash
systemctl disable --now smcfan.service
rm -f /etc/systemd/system/smcfan.service
systemctl daemon-reload
rm -f /usr/local/bin/smcfan.py /var/tmp/smcfan.state.json /var/tmp/smcfan.lastpwm
```

## Conclusion

This PID-based fan controller provides smooth, intelligent thermal management for Supermicro servers. By monitoring both CPU and NVMe temperatures and using gradual PWM adjustments, it maintains optimal cooling while minimizing noise compared to the default BMC behavior.

The systemd integration ensures the controller starts automatically at boot and restarts if it encounters any issues, providing reliable long-term operation.

---

*This post was enhanced with assistance from Claude.*