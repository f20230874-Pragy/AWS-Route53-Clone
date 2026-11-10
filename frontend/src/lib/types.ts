export interface User { username: string; account_id: string }
export interface Zone {
  id: string; name: string; type: "public" | "private"; comment: string; created_by: string;
  record_count: number; vpc_region: string | null; vpc_id: string | null; tags: Record<string, string>; created_at: string;
}
export interface DnsRecord {
  id: number; zone_id: string; name: string; type: string; ttl: number | null; values: string[];
  is_alias: boolean; alias_target: string | null; evaluate_target_health: boolean;
  routing_policy: string; set_identifier: string | null; weight: number | null; region: string | null;
  failover_role: string | null; location: string | null; health_check_id: string | null;
}
export interface Paged<T> { items: T[]; total: number; page: number; page_size: number }
export interface ImportResult { created: number; updated: number; skipped: string[]; errors: string[] }

export const RECORD_TYPES: { value: string; desc: string; hint: string }[] = [
  { value: "A", desc: "Routes traffic to an IPv4 address and some AWS resources", hint: "192.0.2.235" },
  { value: "AAAA", desc: "Routes traffic to an IPv6 address and some AWS resources", hint: "2001:0db8:85a3::8a2e:0370:7334" },
  { value: "CAA", desc: "Restricts CAs that can create SSL/TLS certifications for the domain", hint: '0 issue "letsencrypt.org"' },
  { value: "CNAME", desc: "Routes traffic to another domain name and to some AWS resources", hint: "www.example.com" },
  { value: "MX", desc: "Routes traffic to mail servers", hint: "10 mail.example.com" },
  { value: "NS", desc: "Identifies the name servers for the hosted zone", hint: "ns-1.example.net" },
  { value: "PTR", desc: "Maps an IP address to a domain name", hint: "www.example.com" },
  { value: "SRV", desc: "Application-specific values that identify servers", hint: "1 10 5269 xmpp-server.example.com" },
  { value: "TXT", desc: "Used to verify email senders and for application-specific values", hint: '"Sample text"' },
];
export const ROUTING_POLICIES = ["Simple", "Weighted", "Latency", "Failover", "Geolocation", "Multivalue answer"];
export const REGIONS = ["us-east-1", "us-east-2", "us-west-1", "us-west-2", "eu-west-1", "eu-west-2", "eu-central-1", "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "sa-east-1"];
export const LOCATIONS = ["Default", "North America", "Europe", "Asia", "South America", "Africa", "Oceania", "United States", "India", "Germany", "United Kingdom", "Japan"];
