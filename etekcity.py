from pyvesync_v2 import VeSync
import os

USER = os.getenv('VESYNC_USER')
PASSWORD= os.getenv('VESYNC_PASSWORD')

manager = VeSync(USER, PASSWORD, "America/New_York")
manager.login()

# Get/Update Devices from server - populate device lists
manager.update()

# Display outlet device information
for device in manager.outlets:
    print(device.display_json())
