/**
 * Unit tests for response formatter utilities
 */

import { Response } from 'express';
import { sendSuccess, sendError } from '../../../../src/api/utils/response-formatter';

describe('Response Formatter Utils', () => {
  let mockResponse: Partial<Response>;
  let mockStatus: jest.Mock;
  let mockJson: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockResponse = {
      status: mockStatus,
    };
  });

  describe('sendSuccess', () => {
    it('should send success response with data and default status code 200', () => {
      const data = { id: '123', name: 'Test' };

      sendSuccess(mockResponse as Response, data);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });

    it('should send success response with custom status code', () => {
      const data = { id: '123', name: 'Test' };

      sendSuccess(mockResponse as Response, data, 201);

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });

    it('should send success response with array data', () => {
      const data = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ];

      sendSuccess(mockResponse as Response, data);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });

    it('should send success response with null data', () => {
      sendSuccess(mockResponse as Response, null);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: null,
      });
    });

    it('should send success response with empty object', () => {
      sendSuccess(mockResponse as Response, {});

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {},
      });
    });
  });

  describe('sendError', () => {
    it('should send error response with message and default status code 500', () => {
      const error = 'Internal server error';

      sendError(mockResponse as Response, error);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        data: null,
        error,
      });
    });

    it('should send error response with custom status code', () => {
      const error = 'Not found';

      sendError(mockResponse as Response, error, 404);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        data: null,
        error,
      });
    });

    it('should send error response with validation error', () => {
      const error = 'Validation failed: email must be valid';

      sendError(mockResponse as Response, error, 400);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        data: null,
        error,
      });
    });

    it('should send error response with unauthorized error', () => {
      const error = 'Unauthorized access';

      sendError(mockResponse as Response, error, 401);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        data: null,
        error,
      });
    });
  });
});
