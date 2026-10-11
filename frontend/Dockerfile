FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY shared/package.json shared/package.json
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY shared shared
COPY frontend frontend
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLIC_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLIC_KEY=$VITE_SUPABASE_PUBLIC_KEY
ENV VITE_API_URL=""
RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_PUBLIC_KEY"
RUN npm run build -w shared && npm run build -w frontend

FROM nginxinc/nginx-unprivileged:stable-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
