import os
from setuptools import setup

version_path = os.path.join(os.path.abspath(os.path.dirname(__file__)),
                            'src', 'canal', '__init__.py')
with open(version_path) as fp:
    exec(fp.read())

with open('README.md', 'r', encoding='utf-8') as fh:
    long_description = fh.read()

setup(name='canal-mqtt',
      version=str(__version__),
      packages=['canal', 'canal'],
      package_dir={'canal': 'src/canal'},
      maintainer='Anderson Antunes',
      maintainer_email='anderson.utf@gmail.com',
      url='https://github.com/anderson-/canal',
      description='Transfer data through public MQTT brokers using TLS',
      long_description=long_description,
      long_description_content_type='text/markdown',
      install_requires=['paho-mqtt'],
      include_package_data=True)