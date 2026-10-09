# Banban Docker

这个目录用于把斑斑无桌面版发布物打成 Docker 镜像，并发布到 Docker Hub。

## 当前镜像

- 镜像地址：`__IMAGE_REF__`
- 版本：`__VERSION__`

## 发布到 Docker Hub

1. 先登录 Docker Hub：

```bash
docker login
```

2. 在当前目录构建镜像：

```bash
docker build -t __IMAGE_REF__ .
```

3. 推送镜像：

```bash
docker push __IMAGE_REF__
```

## 客户安装

1. 如需调整端口、数据库或 HTTPS，请先修改 [config.jsonc](./config.jsonc)。
2. 在线安装：

```bash
export BANBAN_IMAGE=__IMAGE_REF__
docker compose up -d
```

3. 离线安装：

```bash
docker load -i __OFFLINE_IMAGE_FILE__
export BANBAN_IMAGE=__IMAGE_REF__
docker compose up -d
```

## 数据目录

- 容器内数据目录：`/root/.config/banban`
- `docker-compose.yml` 默认用命名卷 `banban-data` 持久化

## 说明

- 若 `config.jsonc` 中启用了 HTTPS 证书，请额外挂载证书目录到容器内。
- 若需要导出离线包，可执行：

```bash
docker save __IMAGE_REF__ | gzip > __OFFLINE_IMAGE_FILE__
```
