/**
 * VERDICT Frontend API Client Service
 */

// In development, the Node server is hosted on port 5000. In production, we assume relative pathing or reverse proxying.
const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const verdictApi = {
  /**
   * Generates the SSE stream URL for the verdict request
   */
  getVerdictStreamUrl(query: string): string {
    const encodedQuery = encodeURIComponent(query.trim());
    return `${BACKEND_BASE_URL}/api/verdict?query=${encodedQuery}`;
  },

  /**
   * Utility to check backend health status
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        return data.status === 'healthy';
      }
      return false;
    } catch {
      return false;
    }
  }
};

export default verdictApi;
