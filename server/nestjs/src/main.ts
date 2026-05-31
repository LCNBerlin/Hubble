import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: true });

  const port = process.env.PORT || 4243;
  await app.listen(port);
  console.log(`Hubble API running on http://localhost:${port}/api`);
}

bootstrap();
