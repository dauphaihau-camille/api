export interface SseEvent<TData extends string | object = Record<string, unknown>> {
  type: string;
  data: TData;
  id?: string;
}
