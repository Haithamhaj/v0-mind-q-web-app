import Link from "next/link"
import { Activity, Brain, CheckCircle2, Database, LayoutDashboard, Play, Settings, Workflow } from "lucide-react"

import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const dashboardSections = [
  {
    title: "نظرة عامة",
    description: "ملخص سريع عن حالة المنصة وروابط الوصول السريع.",
    icon: LayoutDashboard,
    cards: [
      {
        title: "نتائج الـPipeline",
        href: "/results",
        icon: Workflow,
        description: "استعرض مخرجات كل Run مع القياسات والملفات الناتجة.",
      },
      {
        title: "لوحة BI",
        href: "/bi",
        icon: Brain,
        description: "لوحة BI الموحّدة المرتبطة بالباك إند للتحليلات السردية.",
      },
    ],
  },
  {
    title: "تشغيل ومراقبة",
    description: "إدارة مراحل التنفيذ وتتبع الحالة اللحظية.",
    icon: Play,
    cards: [
      {
        title: "تشغيل الـPipeline",
        href: "/pipeline",
        icon: Play,
        description: "تهيئة وتشغيل المسار الكامل مع مراقبة تقدم المراحل.",
      },
      {
        title: "المراحل التفصيلية",
        href: "/phases",
        icon: Activity,
        description: "راقب كل مرحلة على حدة مع إمكان تكوين المدخلات.",
      },
      {
        title: "التزام SLA",
        href: "/sla",
        icon: CheckCircle2,
        description: "تحليل أداء SLA مع المساعد الذكي ونماذج الأسئلة.",
      },
    ],
  },
  {
    title: "إدارة البيانات",
    description: "إدارة المصادر والإعدادات لضمان تدفق مستقر.",
    icon: Database,
    cards: [
      {
        title: "مصادر البيانات",
        href: "/sources",
        icon: Database,
        description: "تحكم في حالة الربط وتحقق من أحدث عمليات المزامنة.",
      },
      {
        title: "التهيئة العامة",
        href: "/settings",
        icon: Settings,
        description: "إدارة التهيئة الافتراضية، مخرجات المراحل والمؤشرات.",
      },
    ],
  },
]

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background px-6 py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-8">
            <header className="space-y-3 text-start">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">Mind-Q V4</p>
              <h1 className="text-3xl font-bold text-foreground md:text-4xl">منصة التحكم والتحليلات</h1>
              <p className="text-base text-muted-foreground md:text-lg">
                هذه هي صفحتك الرئيسية للوصول السريع إلى كل المراحل: تشغيل الـPipeline، متابعة النتائج، ولوحة BI الواحدة
                المرتبطة بالباك إند. اختر القسم المناسب لبدء العمل.
              </p>
            </header>

            <div className="grid gap-6">
              {dashboardSections.map((section) => (
                <section key={section.title} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <section.icon className="h-6 w-6 text-primary" />
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {section.cards.map((card) => (
                      <Card
                        key={card.href}
                        className="group border-border/60 bg-card/80 shadow-sm transition hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg"
                      >
                        <CardHeader className="space-y-2">
                          <div className="flex items-center gap-3">
                            <card.icon className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">{card.title}</CardTitle>
                          </div>
                          <CardDescription className="text-sm text-muted-foreground">{card.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Button asChild variant="secondary" className="w-full justify-start gap-2">
                            <Link href={card.href}>الدخول</Link>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
