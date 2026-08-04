// 测试 fastify - 回调版本
import { Fastify, listen } from "fastify";

const app = new Fastify();

// 使用 get 注册路由
app.get("/test", () => {
  return { ok: true };
});

// 使用回调风格的 listen
listen(app, { port: 9876 }, (err: any) => {
  if (err) {
    console.log("Listen error:", String(err));
  } else {
    console.log("fastify listening on 9876");
  }
});

// 保持进程存活
setTimeout(() => {}, 10000);