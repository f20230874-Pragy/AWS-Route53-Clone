import { Breadcrumbs, Container, PageHeader } from "@/components/ui";
import { NAV } from "@/components/Shell";

export default function ComingSoon({ params }: { params: { slug: string[] } }) {
  const href = "/" + params.slug.join("/");
  const item = NAV.flatMap((g) => g.items).find((i) => i.href === href);
  const title = item?.text ?? params.slug[params.slug.length - 1].replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
  return (
    <>
      <Breadcrumbs items={[{ text: "Route 53", href: "/hosted-zones" }, { text: title }]} />
      <PageHeader title={title} />
      <Container>
        <div className="coming">
          <div className="big">Coming soon</div>
          <p>This section of the console is a placeholder in this clone.</p>
        </div>
      </Container>
    </>
  );
}
