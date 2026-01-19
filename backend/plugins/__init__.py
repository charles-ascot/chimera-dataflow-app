"""Plugin system for data source providers."""

from .base import SourcePlugin
from .betfair import BetfairPlugin
from .racing_api import RacingAPIPlugin

# Registry of available plugins
PLUGINS = {
    "betfair": BetfairPlugin(),
    "racing_api": RacingAPIPlugin(),
}


def get_plugin(name: str) -> SourcePlugin:
    """Get a plugin by name."""
    plugin = PLUGINS.get(name)
    if not plugin:
        raise ValueError(f"Unknown plugin: {name}")
    return plugin


def list_plugins() -> list:
    """List all available plugins with their metadata."""
    return [
        {
            "id": name,
            "name": plugin.name,
            "extensions": plugin.extensions,
            "compression": plugin.compression,
            "enabled": plugin.enabled,
            "description": plugin.description,
        }
        for name, plugin in PLUGINS.items()
    ]
