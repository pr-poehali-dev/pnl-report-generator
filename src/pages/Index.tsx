import { useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

const services = [
  {
    icon: "Monitor",
    title: "Веб-разработка",
    desc: "Сайты и приложения, которые работают безупречно. Чистый код, современные технологии.",
  },
  {
    icon: "Palette",
    title: "UI/UX Дизайн",
    desc: "Интерфейсы, которые интуитивно понятны и визуально безупречны. Каждая деталь продумана.",
  },
  {
    icon: "Zap",
    title: "Быстрый запуск",
    desc: "От идеи до живого продукта за считанные дни. Никаких лишних согласований.",
  },
  {
    icon: "Shield",
    title: "Поддержка",
    desc: "Всегда на связи. Обслуживаем и развиваем проект после запуска.",
  },
];

const works = [
  { num: "01", title: "Интернет-магазин", tag: "E-commerce", year: "2024" },
  { num: "02", title: "Корпоративный сайт", tag: "Branding", year: "2024" },
  { num: "03", title: "Мобильное приложение", tag: "Product", year: "2023" },
];

const stats = [
  { value: "120+", label: "проектов" },
  { value: "8", label: "лет опыта" },
  { value: "98%", label: "довольных клиентов" },
];

export default function Index() {
  const revealRefs = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.12 }
    );

    document.querySelectorAll(".reveal").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="noise-bg min-h-screen bg-[#0E0B08] text-[hsl(40,20%,92%)] overflow-x-hidden">
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="animate-blob absolute -top-32 -left-32 w-[600px] h-[600px] opacity-[0.06]"
          style={{
            background: "radial-gradient(circle, #C9A96E 0%, transparent 70%)",
          }}
        />
        <div
          className="animate-blob absolute -bottom-24 -right-24 w-[500px] h-[500px] opacity-[0.05]"
          style={{
            background: "radial-gradient(circle, #C9A96E 0%, transparent 70%)",
            animationDelay: "4s",
          }}
        />
      </div>

      {/* NAV */}
      <nav className="relative z-10 flex items-center justify-between px-8 md:px-16 py-7">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: "#C9A96E" }}
          />
          <span
            className="font-cormorant text-xl tracking-widest uppercase"
            style={{ fontFamily: "Cormorant, serif", letterSpacing: "0.18em" }}
          >
            Студия
          </span>
        </div>
        <div className="hidden md:flex items-center gap-10 text-sm tracking-wide text-[hsl(40,10%,60%)]">
          <a href="#services" className="hover:text-[#C9A96E] transition-colors duration-200">Услуги</a>
          <a href="#works" className="hover:text-[#C9A96E] transition-colors duration-200">Работы</a>
          <a href="#contact" className="hover:text-[#C9A96E] transition-colors duration-200">Контакты</a>
        </div>
        <button
          className="px-5 py-2.5 text-sm tracking-wide border border-[rgba(201,169,110,0.4)] text-[#C9A96E] hover:bg-[rgba(201,169,110,0.08)] transition-all duration-300 rounded-sm"
        >
          Обсудить проект
        </button>
      </nav>

      {/* HERO */}
      <section className="relative z-10 px-8 md:px-16 pt-20 pb-32">
        <div className="max-w-5xl">
          <div
            className="animate-fade-up opacity-0 text-xs tracking-[0.3em] uppercase text-[#C9A96E] mb-8 flex items-center gap-3"
          >
            <span className="inline-block w-8 h-px bg-[#C9A96E]" />
            Цифровая студия · 2016
          </div>

          <h1
            className="animate-fade-up opacity-0 delay-200"
            style={{
              fontFamily: "Cormorant, serif",
              fontSize: "clamp(3.5rem, 9vw, 8rem)",
              lineHeight: 1.0,
              fontWeight: 300,
              letterSpacing: "-0.01em",
              color: "hsl(40, 20%, 92%)",
            }}
          >
            Создаём
            <br />
            <span className="gold-text italic">цифровые</span>
            <br />
            продукты
          </h1>

          <p
            className="animate-fade-up opacity-0 delay-400 mt-10 text-[hsl(40,10%,58%)] text-lg max-w-lg leading-relaxed"
            style={{ fontFamily: "Golos Text, sans-serif" }}
          >
            Разрабатываем сайты, приложения и интерфейсы, которые работают на результат.
            Быстро, красиво, без компромиссов.
          </p>

          <div className="animate-fade-up opacity-0 delay-600 flex items-center gap-6 mt-12">
            <button
              className="animate-pulse-glow px-8 py-4 text-sm tracking-wider uppercase font-medium transition-all duration-300 hover:scale-[1.03]"
              style={{
                background: "linear-gradient(135deg, #C9A96E 0%, #E8CC9A 100%)",
                color: "#0E0B08",
                borderRadius: "2px",
                fontFamily: "Golos Text, sans-serif",
                letterSpacing: "0.12em",
              }}
            >
              Начать проект
            </button>
            <button
              className="flex items-center gap-2 text-sm tracking-wide text-[hsl(40,10%,58%)] hover:text-[#C9A96E] transition-colors duration-200"
              style={{ fontFamily: "Golos Text, sans-serif" }}
            >
              <span>Смотреть работы</span>
              <Icon name="ArrowRight" size={16} />
            </button>
          </div>

          {/* Stats */}
          <div className="animate-fade-up opacity-0 delay-800 mt-20 grid grid-cols-3 gap-8 max-w-lg">
            {stats.map((s) => (
              <div key={s.label}>
                <div
                  style={{
                    fontFamily: "Cormorant, serif",
                    fontSize: "2.8rem",
                    fontWeight: 300,
                    color: "#C9A96E",
                    lineHeight: 1,
                  }}
                >
                  {s.value}
                </div>
                <div className="text-xs tracking-wider uppercase text-[hsl(40,10%,45%)] mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Decorative element */}
        <div
          className="animate-float absolute right-8 md:right-24 top-32 opacity-20 pointer-events-none hidden md:block"
          style={{ animationDelay: "1s" }}
        >
          <div
            style={{
              width: 320,
              height: 320,
              border: "1px solid #C9A96E",
              borderRadius: "50%",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 30,
                border: "1px solid rgba(201,169,110,0.4)",
                borderRadius: "50%",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 70,
                border: "1px solid rgba(201,169,110,0.2)",
                borderRadius: "50%",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%,-50%)",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#C9A96E",
              }}
            />
          </div>
        </div>
      </section>

      {/* DIVIDER */}
      <div className="relative z-10 px-8 md:px-16">
        <div style={{ height: 1, background: "linear-gradient(to right, transparent, rgba(201,169,110,0.3), transparent)" }} />
      </div>

      {/* SERVICES */}
      <section id="services" className="relative z-10 px-8 md:px-16 py-28">
        <div className="reveal mb-16">
          <div className="text-xs tracking-[0.3em] uppercase text-[#C9A96E] mb-4 flex items-center gap-3">
            <span className="inline-block w-8 h-px bg-[#C9A96E]" />
            Услуги
          </div>
          <h2
            style={{
              fontFamily: "Cormorant, serif",
              fontSize: "clamp(2.5rem, 5vw, 4rem)",
              fontWeight: 300,
              color: "hsl(40, 20%, 92%)",
              lineHeight: 1.1,
            }}
          >
            Что мы делаем
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {services.map((s, i) => (
            <div
              key={s.title}
              className="reveal card-hover p-7 border border-[rgba(201,169,110,0.1)] bg-[rgba(255,255,255,0.02)]"
              style={{ borderRadius: "4px", transitionDelay: `${i * 80}ms` }}
            >
              <div
                className="mb-6 w-10 h-10 flex items-center justify-center"
                style={{
                  border: "1px solid rgba(201,169,110,0.3)",
                  borderRadius: "2px",
                  color: "#C9A96E",
                }}
              >
                <Icon name={s.icon} size={20} />
              </div>
              <h3
                className="mb-3 text-lg"
                style={{
                  fontFamily: "Cormorant, serif",
                  fontWeight: 400,
                  fontSize: "1.35rem",
                  color: "hsl(40, 20%, 92%)",
                }}
              >
                {s.title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "hsl(40,10%,52%)", fontFamily: "Golos Text, sans-serif" }}
              >
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* WORKS */}
      <section id="works" className="relative z-10 px-8 md:px-16 py-20">
        <div className="reveal mb-16">
          <div className="text-xs tracking-[0.3em] uppercase text-[#C9A96E] mb-4 flex items-center gap-3">
            <span className="inline-block w-8 h-px bg-[#C9A96E]" />
            Портфолио
          </div>
          <h2
            style={{
              fontFamily: "Cormorant, serif",
              fontSize: "clamp(2.5rem, 5vw, 4rem)",
              fontWeight: 300,
              color: "hsl(40, 20%, 92%)",
            }}
          >
            Избранные работы
          </h2>
        </div>

        <div className="space-y-0">
          {works.map((w, i) => (
            <div
              key={w.num}
              className="reveal group flex items-center justify-between py-7 border-b border-[rgba(201,169,110,0.1)] cursor-pointer hover:pl-4 transition-all duration-300"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center gap-8">
                <span
                  style={{
                    fontFamily: "Cormorant, serif",
                    fontSize: "0.85rem",
                    color: "rgba(201,169,110,0.5)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {w.num}
                </span>
                <h3
                  style={{
                    fontFamily: "Cormorant, serif",
                    fontSize: "clamp(1.5rem, 3vw, 2.4rem)",
                    fontWeight: 300,
                    color: "hsl(40, 20%, 92%)",
                  }}
                  className="group-hover:text-[#C9A96E] transition-colors duration-300"
                >
                  {w.title}
                </h3>
              </div>
              <div className="flex items-center gap-6">
                <span
                  className="hidden md:block text-xs tracking-widest uppercase border border-[rgba(201,169,110,0.25)] px-3 py-1"
                  style={{ color: "#C9A96E", borderRadius: "2px" }}
                >
                  {w.tag}
                </span>
                <span className="text-sm text-[hsl(40,10%,45%)]">{w.year}</span>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[#C9A96E]">
                  <Icon name="ArrowUpRight" size={20} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="reveal mt-10">
          <button
            className="flex items-center gap-2 text-sm tracking-wider text-[hsl(40,10%,55%)] hover:text-[#C9A96E] transition-colors duration-200"
            style={{ fontFamily: "Golos Text, sans-serif" }}
          >
            Все проекты
            <Icon name="ArrowRight" size={16} />
          </button>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="relative z-10 px-8 md:px-16 py-28">
        <div
          className="reveal max-w-3xl mx-auto text-center py-20 px-8 border border-[rgba(201,169,110,0.15)] relative overflow-hidden"
          style={{ borderRadius: "6px", background: "rgba(201,169,110,0.03)" }}
        >
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-[#C9A96E]" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-[#C9A96E]" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-[#C9A96E]" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-[#C9A96E]" />

          <div className="text-xs tracking-[0.3em] uppercase text-[#C9A96E] mb-6">
            Начнём работу?
          </div>
          <h2
            style={{
              fontFamily: "Cormorant, serif",
              fontSize: "clamp(2.2rem, 5vw, 3.8rem)",
              fontWeight: 300,
              color: "hsl(40, 20%, 92%)",
              lineHeight: 1.1,
            }}
          >
            Расскажите
            <br />
            <span className="gold-text italic">о вашем проекте</span>
          </h2>
          <p
            className="mt-6 mb-10 text-[hsl(40,10%,55%)] leading-relaxed max-w-md mx-auto"
            style={{ fontFamily: "Golos Text, sans-serif" }}
          >
            Ответим в течение одного рабочего дня. Первая консультация — бесплатно.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              className="px-8 py-4 text-sm tracking-wider uppercase font-medium transition-all duration-300 hover:scale-[1.03] hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg, #C9A96E 0%, #E8CC9A 100%)",
                color: "#0E0B08",
                borderRadius: "2px",
                fontFamily: "Golos Text, sans-serif",
                letterSpacing: "0.12em",
              }}
            >
              Написать нам
            </button>
            <button
              className="px-8 py-4 text-sm tracking-wider uppercase border border-[rgba(201,169,110,0.3)] text-[#C9A96E] hover:bg-[rgba(201,169,110,0.07)] transition-all duration-300"
              style={{
                borderRadius: "2px",
                fontFamily: "Golos Text, sans-serif",
                letterSpacing: "0.12em",
              }}
            >
              +7 (000) 000-00-00
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 px-8 md:px-16 py-10 border-t border-[rgba(201,169,110,0.1)]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#C9A96E]" />
            <span
              className="tracking-widest text-sm uppercase"
              style={{ fontFamily: "Cormorant, serif" }}
            >
              Студия
            </span>
          </div>
          <div
            className="text-xs text-[hsl(40,10%,35%)]"
            style={{ fontFamily: "Golos Text, sans-serif" }}
          >
            © 2024 Студия. Все права защищены.
          </div>
          <div className="flex items-center gap-5">
            {["Telegram", "VK", "Behance"].map((link) => (
              <a
                key={link}
                href="#"
                className="text-xs tracking-wide text-[hsl(40,10%,40%)] hover:text-[#C9A96E] transition-colors duration-200"
                style={{ fontFamily: "Golos Text, sans-serif" }}
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}