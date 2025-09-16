/**
 * JSON-RPC Type Tests
 *
 * Test suite for JSON-RPC protocol types and validation
 * Following TDD principles with comprehensive type checking
 *
 * @author aezizhu
 * @version 1.0.0
 */

import { describe, it, expect } from 'vitest';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  JsonRpcNotification,
  JsonRpcErrorCode,
  MCP_PROTOCOL_VERSION,
} from '../../../src/types/mcp';

describe('JSON-RPC Types', () => {
  describe('JsonRpcRequest', () => {
    it('should accept valid request with required fields', () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'test.method',
        id: '123',
      };

      expect(request.jsonrpc).toBe('2.0');
      expect(request.method).toBe('test.method');
      expect(request.id).toBe('123');
    });

    it('should accept request with params', () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'test.method',
        params: { key: 'value' },
        id: 456,
      };

      expect(request.params).toEqual({ key: 'value' });
      expect(request.id).toBe(456);
    });

    it('should accept request with array params', () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'test.method',
        params: ['arg1', 'arg2'],
        id: null,
      };

      expect(request.params).toEqual(['arg1', 'arg2']);
      expect(request.id).toBeNull();
    });
  });

  describe('JsonRpcResponse', () => {
    it('should accept successful response', () => {
      const response: JsonRpcResponse<string> = {
        jsonrpc: '2.0',
        id: '123',
        result: 'success',
      };

      expect(response.result).toBe('success');
      expect(response.error).toBeUndefined();
    });

    it('should accept error response', () => {
      const error: JsonRpcError = {
        code: JsonRpcErrorCode.INVALID_PARAMS,
        message: 'Invalid parameters',
      };

      const response: JsonRpcResponse<never> = {
        jsonrpc: '2.0',
        id: '123',
        error,
      };

      expect(response.error).toEqual(error);
      expect(response.result).toBeUndefined();
    });
  });

  describe('JsonRpcError', () => {
    it('should accept error with required fields', () => {
      const error: JsonRpcError = {
        code: JsonRpcErrorCode.METHOD_NOT_FOUND,
        message: 'Method not found',
      };

      expect(error.code).toBe(JsonRpcErrorCode.METHOD_NOT_FOUND);
      expect(error.message).toBe('Method not found');
    });

    it('should accept error with optional data', () => {
      const error: JsonRpcError = {
        code: JsonRpcErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
        data: { details: 'Database connection failed' },
      };

      expect(error.data).toEqual({ details: 'Database connection failed' });
    });
  });

  describe('JsonRpcNotification', () => {
    it('should accept notification with required fields', () => {
      const notification: JsonRpcNotification = {
        jsonrpc: '2.0',
        method: 'test.notification',
      };

      expect(notification.jsonrpc).toBe('2.0');
      expect(notification.method).toBe('test.notification');
      expect(notification.params).toBeUndefined();
    });

    it('should accept notification with params', () => {
      const notification: JsonRpcNotification = {
        jsonrpc: '2.0',
        method: 'test.notification',
        params: { event: 'user_connected', userId: 123 },
      };

      expect(notification.params).toEqual({
        event: 'user_connected',
        userId: 123,
      });
    });
  });

  describe('JsonRpcErrorCode', () => {
    it('should have correct error code values', () => {
      expect(JsonRpcErrorCode.PARSE_ERROR).toBe(-32700);
      expect(JsonRpcErrorCode.INVALID_REQUEST).toBe(-32600);
      expect(JsonRpcErrorCode.METHOD_NOT_FOUND).toBe(-32601);
      expect(JsonRpcErrorCode.INVALID_PARAMS).toBe(-32602);
      expect(JsonRpcErrorCode.INTERNAL_ERROR).toBe(-32603);
    });
  });

  describe('MCP_PROTOCOL_VERSION', () => {
    it('should be the correct MCP protocol version', () => {
      expect(MCP_PROTOCOL_VERSION).toBe('2024-11-05');
    });
  });
});
