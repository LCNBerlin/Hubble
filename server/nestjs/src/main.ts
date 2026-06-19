import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const allowedOrigins = process.env.ALLOWED_ORIGINS;
  app.enableCors({
    origin: allowedOrigins ? allowedOrigins.split(",").map((o) => o.trim()) : true,
  });

  const port = process.env.PORT || 4243;
  await app.listen(port, "0.0.0.0");
  console.log(`Hubble API running on port ${port}`);
}

bootstrap();
