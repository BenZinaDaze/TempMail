# 第一阶段：构建前端
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 安装依赖 (仅当 package.json 变更时才重新运行)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# 复制源码并构建
COPY frontend/ ./
# 强制置空 VITE_API_URL 和 VITE_WS_URL，确保生产环境使用相对路径和自动推断
ENV VITE_API_URL=""
ENV VITE_WS_URL=""
RUN npm run build

# 第二阶段：设置后端
FROM node:20-alpine

# 设置生产环境 (优化性能)
ENV NODE_ENV=production

WORKDIR /app/backend

# 安装后端依赖 (仅生产依赖)
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --only=production

# 复制后端源码
COPY backend/ ./

# 从第一阶段复制构建好的前端资源
# 后端 server.js 预期静态文件位于相对于 src/server.js 的 ../public 目录
COPY --from=frontend-builder /app/frontend/dist ./public

# 暴露端口
# 3000: Web 界面 + API + WebSocket
# 2525: SMTP 邮件服务
EXPOSE 3000 2525

# 启动命令
CMD ["node", "src/server.js"]
