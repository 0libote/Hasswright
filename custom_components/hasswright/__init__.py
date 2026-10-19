"""Placeholder optional integration that registers a config entry only.

No privileged HTTP/file/YAML API is implemented. The add-on works without it.
"""
from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

DOMAIN = "hasswright"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:  # NOSONAR -- HA contract requires async even without await
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = entry.data
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:  # NOSONAR -- HA contract requires async even without await
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    return True
