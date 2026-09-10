export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface HealthStatus {
  status: "ok" | "degraded";
  dependencies: {
    postgres: boolean;
    redis: boolean;
    rabbitmq: boolean;
  };
}
