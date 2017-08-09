FROM ubuntu:xenial

COPY nodejs_6.10.0-1nodesource1-xenial1_amd64.deb /tmp/
RUN export DEBIAN_FRONTEND=noninteractive &&  ( apt-get update || true ) && apt-get -y install openssh-server vim git apt microcom cryptsetup dkms python-netifaces sysstat bridge-utils python-serial openvpn network-manager libudev-dev curl unzip apt-offline python-crypto
RUN dpkg -i /tmp/nodejs_6.10.0-1nodesource1-xenial1_amd64.deb && apt-get -y install -f && npm install -g removeNPMAbsolutePaths
COPY bits-tools /opt/bits-tools
