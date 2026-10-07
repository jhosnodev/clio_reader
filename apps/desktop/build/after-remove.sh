#!/bin/bash

# Remove the AppArmor profile installed by the package
if [ -f /etc/apparmor.d/${executable} ]; then
    if command -v apparmor_parser >/dev/null 2>&1; then
        apparmor_parser -R /etc/apparmor.d/${executable} 2>/dev/null || true
    fi
    rm -f /etc/apparmor.d/${executable}
fi

# Delete the link to the binary
if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove '${executable}' '/usr/bin/${executable}'
else
    rm -f '/usr/bin/${executable}'
fi
