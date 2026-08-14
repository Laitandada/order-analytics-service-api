<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Database and Seeding

We use Prisma with PostgreSQL. Before running the application, make sure to set up your `.env` file (copied from `.env.example`) and apply the migrations:

```bash
# Run migrations to set up PostgreSQL database
$ npx prisma migrate dev --name init_core_schema
```

### Seeding Modes

To populate the database, we provide two seeding scripts configured in `package.json`:

1. **Development Seed** (10,000 orders, 1,000 customers, 20 products):
   Designed for local development and rapid integration testing. Takes ~1-2 seconds.
   ```bash
   $ npm run db:seed:dev
   ```

2. **Full Assessment Seed** (approximately 5,000,000 orders, 50,000 customers, 500 products):
   Designed for large-scale performance, indexing, and analytics testing.
   ```bash
   $ npm run db:seed:full
   ```

### Performance & Resource Considerations for Full Seeding (5M Orders)
- **Memory Consumption**: Generation is performed in streamed chunks of **2,500 orders** to keep JavaScript Heap memory stable and prevent OOM issues (allocates <150MB of RSS).
- **Execution Speed**: Chunked insertions use atomic `createMany` queries. The expected duration to insert 5,000,000 orders (and their ~12.5M order items) is approximately **3 to 6 minutes** depending on disk/network latency to PostgreSQL.
- **Constraints**: Staying at 2,500 orders per batch ensures we stay well below PostgreSQL's 65,535 parameter limit per command (averaging ~32,000 parameters for the order items chunk).

## PostgreSQL Connection Pooling

To handle the load testing concurrency (up to 200 concurrent users) efficiently on a database containing 5,000,000 orders without overwhelming database CPU/Memory resources, we configure a connection pool via `pg.Pool` inside our custom `PrismaService` wrapper.

### Pool Configuration Variables

These values are environment-driven and can be configured in `.env`:
* **`DATABASE_POOL_SIZE`** (Default: `20`): The maximum number of active database client connections maintained in the pool.
* **`DATABASE_IDLE_TIMEOUT_MS`** (Default: `30000`): The time in milliseconds a client connection can sit idle before being closed and removed from the pool.
* **`DATABASE_CONNECTION_TIMEOUT_MS`** (Default: `2000`): The time in milliseconds to wait for a database connection to become available before throwing a timeout error.

### Architectural Sizing & Pool Theory

#### Concurrency vs. Database Connections
While NestJS handles 200 concurrent HTTP requests easily using Node's non-blocking single-threaded event loop, PostgreSQL uses a **process-per-connection** architecture. 
* Opening 200 active PostgreSQL connections would spawn 200 separate backend processes on the database. 
* On typical hardware (2 to 4 CPU cores), this causes severe CPU process thrashing, memory bloat, and context-switching overhead.

#### Why a Pool Size of 20?
A pool size of **20** acts as a highly efficient queue. When 200 concurrent requests execute queries, they checkout one of the 20 active connections, execute their indexed query in a few milliseconds, and immediately return it to the pool. PostgreSQL processes these queries sequentially with zero context-switching overhead. This results in **lower overall latency** and protects database resources from starvation.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
