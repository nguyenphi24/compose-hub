export type Service = {
  id?: number;
  name: string;
  image: string;
  container_port: number | null;
  host_port: number | null;
  restart_policy: string;
  environment: Record<string, string>;
  volumes: { source: string; target: string }[];
};

export type Application = {
  id: number;
  name: string;
  environment: string;
  description: string;
  created_at: string;
  services: Service[];
};

export type ServerInfo = {
  online: boolean;
  name?: string;
  docker_version?: string;
  containers?: number;
  containers_running?: number;
  images?: number;
  cpus?: number;
  memory_bytes?: number;
  error?: string;
};

export type ContainerStatus = {
  id: string;
  name: string;
  status: string;
  image: string;
};
