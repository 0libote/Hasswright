"""Hasswright optional integration: narrow privileged API only.

Exposes a single webhook-style view for file/YAML operations that Core
cannot do via REST, gated by HA auth + Hasswright approval tokens.
Optional — the add-on works without it.
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
