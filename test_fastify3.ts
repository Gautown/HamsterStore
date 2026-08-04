// 测试 fastify - 仅测试 listen
import { Fastify, listen } from "fastify";

const app = new Fastify();

console.log("fastify test: about to listen...");

// 使用回调风格的 listen
listen(app, { port: 9876 }, (err: any) => {
  if (err) {
    console.log("Listen error:", String(err));
  } else {
    console.log("fastify listening on 9876");
  }
});