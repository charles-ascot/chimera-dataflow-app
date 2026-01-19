"""Setup file for staging beam_pipeline module to Dataflow workers.

This is required for Dataflow to properly import the beam_pipeline module
on worker nodes. The py_modules parameter ensures beam_pipeline.py is
packaged and distributed to all workers.
"""

from setuptools import setup

setup(
    name='chimera-dataflow-pipeline',
    version='2.0.0',
    description='CHIMERA DataFlow pipeline module for Dataflow workers',
    py_modules=['beam_pipeline'],
    install_requires=[],
)
