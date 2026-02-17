// backend-v2/registry-entities.d.ts
// Type for registry-entities.json
export interface RegistryEntityField {
  name: string;
  type: string;
  [key: string]: any;
}
export interface RegistryEntity {
  id: string;
  fields: Record<string, RegistryEntityField>;
  [key: string]: any;
}
export type RegistryEntities = Record<string, RegistryEntity>;
