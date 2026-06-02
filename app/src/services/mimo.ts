/**
 * Mimo 代理辅助服务
 * 提供健康检查等非业务模型调用能力
 */

export interface MimoHealthStatus {
  ok: boolean;
  service: string;
  baseUrl: string;
  configured: boolean;
  models: Record<string, string>;
  timeouts: Record<string, number>;
}

/** 检查本地 Mimo 代理和环境变量配置状态 */
export async function checkMimoHealth(): Promise<MimoHealthStatus> {
  const response = await fetch('/api/mimo/health', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Mimo 健康检查失败 (${response.status})`);
  }

  return await response.json() as MimoHealthStatus;
}
