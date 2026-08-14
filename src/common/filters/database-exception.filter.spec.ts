import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { DatabaseExceptionFilter } from './database-exception.filter.js';
import { jest } from '@jest/globals';

describe('DatabaseExceptionFilter', () => {
  let filter: DatabaseExceptionFilter;

  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockImplementation(() => ({
    json: mockJson,
  }));
  const mockGetResponse = jest.fn().mockImplementation(() => ({
    status: mockStatus,
  }));
  const mockHost = {
    switchToHttp: () => ({
      getResponse: mockGetResponse,
    }),
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    filter = new DatabaseExceptionFilter();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should pass through standard HttpExceptions unmodified', () => {
    const error = new HttpException(
      'Bad input validation',
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith("Bad input validation");
  });

  it('should sanitize non-HttpException database errors to a generic 500 error', () => {
    const error = new Error('Prisma database syntax error table not found');

    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  });
});
