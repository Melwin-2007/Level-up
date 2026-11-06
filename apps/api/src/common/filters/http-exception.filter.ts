import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorBody, ApiErrorCode } from '@mp/shared';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const requestId = request.headers['x-request-id'];
    if (requestId && !response.getHeader('x-request-id')) {
      response.setHeader('x-request-id', requestId);
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ApiErrorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected server error occurred.';
    let details: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        let resObj = exceptionResponse as Record<string, unknown>;
        if (typeof resObj['error'] === 'object' && resObj['error'] !== null) {
          resObj = { ...resObj, ...(resObj['error'] as Record<string, unknown>) };
        }
        if (typeof resObj['code'] === 'string') {
          code = resObj['code'] as ApiErrorCode;
        }
        if (typeof resObj['message'] === 'string') {
          message = resObj['message'];
        } else if (Array.isArray(resObj['message'])) {
          message = resObj['message'].join(', ');
          details = { validationErrors: resObj['message'] };
        }
        if (typeof resObj['details'] === 'object' && resObj['details'] !== null) {
          details = resObj['details'] as Record<string, unknown>;
        }
      }

      // Default codes based on HTTP status if not explicitly set
      if (code === 'INTERNAL_SERVER_ERROR') {
        switch (status) {
          case HttpStatus.BAD_REQUEST:
            code = 'VALIDATION_FAILED';
            break;
          case HttpStatus.UNAUTHORIZED:
            code = 'UNAUTHENTICATED';
            break;
          case HttpStatus.FORBIDDEN:
            code = 'FORBIDDEN_ROLE';
            break;
          case HttpStatus.NOT_FOUND:
            code = 'NOT_FOUND';
            break;
          case HttpStatus.CONFLICT:
            code = 'CYCLE_STATE_INVALID';
            break;
          case HttpStatus.TOO_MANY_REQUESTS:
            code = 'RATE_LIMITED';
            break;
        }
      }
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error('Unhandled server error in HttpExceptionFilter:', exception);
    }

    const errorBody: ApiErrorBody = {
      error: {
        code,
        message,
        details,
      },
    };

    response.status(status).json(errorBody);
  }
}
