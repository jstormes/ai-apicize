import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  ApicizeClient,
  ApicizeTimeoutError,
  ApicizeNetworkError,
  ApicizeAbortError,
} from './apicize-client';
import { HttpMethod } from '../types';
import { FetchMockBuilder, FetchMockManager, createAbortableFetch } from '../test-utils/index';

describe('ApicizeClient - Edge Cases', () => {
  let client: ApicizeClient;
  const fetchManager = new FetchMockManager();
  const fetchBuilder = new FetchMockBuilder();

  beforeEach(() => {
    fetchManager.save();
    client = new ApicizeClient({ defaultTimeout: 1000 });
  });

  afterEach(() => {
    fetchBuilder.reset();
    fetchManager.restore();
  });

  describe('Network Failures', () => {
    it('should handle complete network failure', async () => {
      fetchBuilder.mockNetworkError(/.*/).getMock();

      await expect(
        client.execute({
          url: 'https://api.example.com/test',
          method: HttpMethod.GET,
        })
      ).rejects.toThrow(ApicizeNetworkError);
    });

    it('should handle DNS resolution failure', async () => {
      fetchManager.mock({ shouldReject: true });
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(
        new Error('getaddrinfo ENOTFOUND api.nonexistent.com')
      );

      await expect(
        client.execute({
          url: 'https://api.nonexistent.com/test',
          method: HttpMethod.GET,
        })
      ).rejects.toThrow(ApicizeNetworkError);
    });

    it('should handle connection refused', async () => {
      fetchManager.mock({ shouldReject: true });
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(
        new Error('connect ECONNREFUSED 127.0.0.1:3000')
      );

      await expect(
        client.execute({
          url: 'http://localhost:3000/test',
          method: HttpMethod.GET,
        })
      ).rejects.toThrow(ApicizeNetworkError);
    });

    it('should handle connection reset', async () => {
      fetchManager.mock({ shouldReject: true });
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(
        new Error('read ECONNRESET')
      );

      await expect(
        client.execute({
          url: 'https://api.example.com/test',
          method: HttpMethod.POST,
          body: { type: 'JSON' as any, data: { large: 'payload' } },
        })
      ).rejects.toThrow(ApicizeNetworkError);
    });
  });

  describe('Timeout Scenarios', () => {
    it('should timeout on slow response', async () => {
      // Response takes longer than timeout
      fetchManager.mock({ delay: 2000 });

      await expect(
        client.execute({
          url: 'https://api.example.com/slow',
          method: HttpMethod.GET,
          timeout: 500,
        })
      ).rejects.toThrow(ApicizeTimeoutError);
    });

    it('should handle timeout with custom duration', async () => {
      fetchManager.mock({ delay: 100 });

      // Should succeed with longer timeout
      const response = await client.execute({
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
        timeout: 500,
      });

      expect(response.status).toBe(200);
    });

    it('should cancel request on timeout', async () => {
      // Create a mock abort controller factory that we can inspect
      const mockController = new AbortController();
      const mockAbortControllerFactory = {
        create: jest.fn().mockReturnValue(mockController),
      };

      // Create client with mock factory
      const testClient = new ApicizeClient(
        { defaultTimeout: 1000 },
        undefined, // use default http client
        mockAbortControllerFactory
      );

      // Mock fetch with delay
      const { fetch: mockFetch } = createAbortableFetch(2000);
      global.fetch = mockFetch as any;

      const promise = testClient.execute({
        url: 'https://api.example.com/slow',
        method: HttpMethod.GET,
        timeout: 500,
      });

      await expect(promise).rejects.toThrow(ApicizeTimeoutError);
      expect(mockController.signal.aborted).toBe(true);
    });
  });

  describe('Redirect Handling', () => {
    it('should follow redirects up to limit', async () => {
      let redirectCount = 0;
      fetchManager.mock().mockImplementation(async () => {
        redirectCount++;
        if (redirectCount <= 5) {
          return {
            status: 302,
            statusText: 'Found',
            headers: new Headers({
              location: `https://api.example.com/redirect${redirectCount}`,
            }),
            redirected: true,
            url: `https://api.example.com/redirect${redirectCount}`,
            text: async () => '',
            json: async () => ({}),
          } as any;
        }
        return {
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          text: async () => 'Final destination',
          json: async () => ({ final: true }),
        } as any;
      });

      const response = await client.withConfig({ maxRedirects: 10 }).execute({
        url: 'https://api.example.com/start',
        method: HttpMethod.GET,
      });

      expect(response.status).toBe(200);
    });

    it('should fail when exceeding redirect limit', async () => {
      let redirectCount = 0;
      fetchManager.mock().mockImplementation(async () => {
        redirectCount++;
        return {
          status: 302,
          statusText: 'Found',
          headers: new Headers({
            location: `https://api.example.com/redirect${redirectCount}`,
          }),
          redirected: true,
          url: `https://api.example.com/redirect${redirectCount}`,
          text: async () => '',
          json: async () => ({}),
        } as any;
      });

      await expect(
        client.withConfig({ maxRedirects: 3 }).execute({
          url: 'https://api.example.com/start',
          method: HttpMethod.GET,
        })
      ).rejects.toThrow('redirect');
    });
  });

  describe('Malformed Response Handling', () => {
    it('should handle invalid JSON response', async () => {
      fetchBuilder
        .whenUrl('https://api.example.com/invalid-json', {
          status: 200,
          body: '{"invalid": json}',
          headers: { 'content-type': 'application/json' },
        })
        .getMock();

      const response = await client.execute({
        url: 'https://api.example.com/invalid-json',
        method: HttpMethod.GET,
      });

      expect(response.status).toBe(200);
      // Body parsing should handle the error gracefully
      if (response.body.type === 'JSON') {
        expect(response.body.data).toBeUndefined();
      }
    });

    it('should handle empty response body', async () => {
      fetchBuilder
        .whenUrl('https://api.example.com/empty', {
          status: 204,
          body: '',
        })
        .getMock();

      const response = await client.execute({
        url: 'https://api.example.com/empty',
        method: HttpMethod.DELETE,
      });

      expect(response.status).toBe(204);
      expect(response.body.type).toBe('None');
    });

    it('should handle response with wrong content-type', async () => {
      fetchBuilder
        .whenUrl('https://api.example.com/wrong-type', {
          status: 200,
          body: '<html>Not JSON</html>',
          headers: { 'content-type': 'application/json' },
        })
        .getMock();

      const response = await client.execute({
        url: 'https://api.example.com/wrong-type',
        method: HttpMethod.GET,
      });

      expect(response.status).toBe(200);
      // Should fall back to text when JSON parsing fails
      if (response.body.type === 'Text') {
        expect(response.body.data).toContain('<html>');
      }
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent requests', async () => {
      fetchBuilder.mockJsonResponse(/.*\/user\/\d+/, { id: 1, name: 'User' }).getMock();

      const requests = Array.from({ length: 10 }, (_, i) =>
        client.execute({
          url: `https://api.example.com/user/${i}`,
          method: HttpMethod.GET,
        })
      );

      const responses = await Promise.all(requests);

      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle mixed success and failure in concurrent requests', async () => {
      fetchBuilder
        .mockJsonResponse(/.*\/success/, { success: true })
        .mockErrorResponse(/.*\/error/, 'Server Error', 500)
        .mockNetworkError(/.*\/network/)
        .getMock();

      const requests = [
        client.execute({ url: 'https://api.example.com/success', method: HttpMethod.GET }),
        client.execute({ url: 'https://api.example.com/error', method: HttpMethod.GET }),
        client.execute({ url: 'https://api.example.com/network', method: HttpMethod.GET }),
      ];

      const results = await Promise.allSettled(requests);

      expect(results[0].status).toBe('fulfilled');
      if (results[0].status === 'fulfilled') {
        expect(results[0].value.status).toBe(200);
      }

      expect(results[1].status).toBe('fulfilled');
      if (results[1].status === 'fulfilled') {
        expect(results[1].value.status).toBe(500);
      }

      expect(results[2].status).toBe('rejected');
      if (results[2].status === 'rejected') {
        expect(results[2].reason).toBeInstanceOf(ApicizeNetworkError);
      }
    });
  });

  describe('Request Cancellation', () => {
    it('should cancel ongoing request', async () => {
      const controller = new AbortController();
      fetchManager.mock({ delay: 1000 });

      const promise = client.execute(
        {
          url: 'https://api.example.com/cancelable',
          method: HttpMethod.GET,
        },
        {
          signal: controller.signal,
        }
      );

      // Cancel after 100ms
      setTimeout(() => controller.abort(), 100);

      await expect(promise).rejects.toThrow(ApicizeAbortError);
    });

    it('should handle pre-aborted signal', async () => {
      const controller = new AbortController();
      controller.abort();

      fetchManager.mock();

      await expect(
        client.execute(
          {
            url: 'https://api.example.com/test',
            method: HttpMethod.GET,
          },
          {
            signal: controller.signal,
          }
        )
      ).rejects.toThrow(ApicizeAbortError);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should handle very large response body', async () => {
      const largeData = 'x'.repeat(10 * 1024 * 1024); // 10MB string
      fetchBuilder
        .whenUrl('https://api.example.com/large', {
          status: 200,
          body: largeData,
          headers: { 'content-type': 'text/plain' },
        })
        .getMock();

      const response = await client.execute({
        url: 'https://api.example.com/large',
        method: HttpMethod.GET,
      });

      expect(response.status).toBe(200);
      if (response.body.type === 'Text') {
        expect((response.body.data as string).length).toBe(largeData.length);
      }
    });

    it('should handle rapid request creation and cancellation', async () => {
      const controllers: AbortController[] = [];
      const requests: Promise<any>[] = [];

      fetchManager.mock({ delay: 100 });

      // Create and immediately cancel 100 requests
      for (let i = 0; i < 100; i++) {
        const controller = new AbortController();
        controllers.push(controller);

        const promise = client.execute(
          {
            url: `https://api.example.com/rapid/${i}`,
            method: HttpMethod.GET,
          },
          {
            signal: controller.signal,
          }
        );

        requests.push(promise);

        // Cancel immediately
        if (i % 2 === 0) {
          controller.abort();
        }
      }

      const results = await Promise.allSettled(requests);

      // At least half should be cancelled
      const cancelled = results.filter(
        r => r.status === 'rejected' && r.reason?.name === 'ApicizeAbortError'
      );
      expect(cancelled.length).toBeGreaterThanOrEqual(45);
    });
  });

  describe('Error Message Quality', () => {
    it('should provide helpful error messages for common issues', async () => {
      fetchManager.mock({ shouldReject: true });
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(
        new Error('fetch failed')
      );

      try {
        await client.execute({
          url: 'https://api.example.com/test',
          method: HttpMethod.GET,
        });
        fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ApicizeNetworkError);
        expect(error.message).toContain('Network error');
        expect(error.message).toContain('https://api.example.com/test');
      }
    });

    it('should include request details in timeout errors', async () => {
      fetchManager.mock({ delay: 2000 });

      try {
        await client.execute({
          url: 'https://api.example.com/slow-endpoint',
          method: HttpMethod.POST,
          timeout: 100,
        });
        fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ApicizeTimeoutError);
        expect(error.message).toContain('100ms');
        expect(error.message).toContain('POST');
        expect(error.message).toContain('https://api.example.com/slow-endpoint');
      }
    });
  });
});
