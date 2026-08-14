import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { ReadPrismaService } from './read-prisma.service.js';

@Global()
@Module({
  providers: [PrismaService, ReadPrismaService],
  exports: [PrismaService, ReadPrismaService],
})
export class PrismaModule {}
