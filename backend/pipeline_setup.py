"""Setup file for staging pipeline modules to Dataflow workers."""

import setuptools

setuptools.setup(
    name='chimera_pipeline',
    version='1.0.0',
    description='CHIMERA Dataflow Pipeline',
    install_requires=[],
    py_modules=['beam_pipeline'],
)
