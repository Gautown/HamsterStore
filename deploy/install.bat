@echo off
echo 安装 HamsterStore Windows 服务...
nssm install HamsterStore "C:\Program Files\HamsterStore\hamsterstore.exe"
nssm set HamsterStore AppDirectory "C:\Program Files\HamsterStore"
nssm set HamsterStore DisplayName "HamsterStore 仓鼠软库"
nssm set HamsterStore Description "GitHub 开源项目聚合加速工具"
nssm set HamsterStore Start SERVICE_AUTO_START
nssm start HamsterStore
echo 服务安装完成