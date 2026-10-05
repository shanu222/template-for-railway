import Link from "next/link";

const technologies = [
  "Next.js",
  "Node.js",
  "PostgreSQL",
  "Redis",
  "Prisma",
  "Railway",
];

export default function HomePage() {
  return (
    <main className="shell">
      <header className="site-header">
        <div className="brand">Production Full-Stack SaaS Starter</div>
        <nav className="nav-actions">
          <Link className="btn btn-ghost" href="/login">
            Log in
          </Link>
          <Link className="btn btn-primary" href="/register">
            Get started
          </Link>
        </nav>
      </header>

      <section className="hero">
        <h1>Production Full-Stack SaaS Starter</h1>
        <p>
          A reusable foundation for deploying a Next.js frontend, Node.js API,
          PostgreSQL database, Redis infrastructure, and authentication on
          Railway.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/register">
            Create an account
          </Link>
          <Link className="btn btn-ghost" href="/dashboard">
            Open dashboard
          </Link>
        </div>
        <div className="tech-row" aria-label="Included technologies">
          {technologies.map((tech) => (
            <span className="tech-chip" key={tech}>
              {tech}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
