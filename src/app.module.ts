import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { PerfMiddleware } from './common/perf.middleware.js';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PrismaModule,
    AnalyticsModule,
    OrdersModule,
    CustomersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PerfMiddleware).forRoutes('*');
  }
}
