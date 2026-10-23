import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex min-h-[80vh] items-center pt-16">
      <div className="container text-center">
        <p className="font-jp text-[120px] leading-none text-shu/20">迷子</p>
        <h1 className="h-display mt-4 text-5xl">This page wandered off.</h1>
        <p className="mt-4 text-sumi-500">Like a tourist in Fushimi Inari’s ten thousand gates.</p>
        <Link href="/" className="btn-primary mt-8">Back to Shojin Pass</Link>
      </div>
    </section>
  );
}
