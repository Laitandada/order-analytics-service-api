import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { ReadPrismaService } from './read-prisma.service.js';
import { DatabaseService } from './database/database.service.js';

@Global()
@Module({
  providers: [PrismaService, ReadPrismaService, DatabaseService],
  exports: [PrismaService, ReadPrismaService, DatabaseService],
})
export class PrismaModule {}
