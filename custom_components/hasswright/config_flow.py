"""Config flow: explicit opt-in only."""
from __future__ import annotations

from homeassistant import config_entries


class HasswrightConfigFlow(config_entries.ConfigFlow, domain="hasswright"):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="Hasswright", data={})
        return self.async_show_form(step_id="user", data_schema={})
