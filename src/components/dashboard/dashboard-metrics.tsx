import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, FilePlus, CheckCircle2, Clock, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import { useDashboardMetrics } from "@/hooks/queries/use-dashboard-metrics";
import type { DashboardMetricsRole } from "@/api/dashboard-metrics";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "tasko:dashboard-metrics-collapsed";

function getStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function setStoredCollapsed(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // ignore
  }
}

interface DashboardMetricsProps {
  role: DashboardMetricsRole;
}

function formatChange(current: number, last: number, isInverseGood = false): {
  text: string;
  direction: "up" | "down" | "same";
  icon: React.ReactNode;
  className: string;
} {
  if (last === 0) {
    return {
      text: current > 0 ? "신규" : "-",
      direction: current > 0 ? "up" : "same",
      icon: current > 0 ? <TrendingUp className="h-4 w-4" /> : <Minus className="h-4 w-4" />,
      className: current > 0 ? "text-primary" : "text-muted-foreground",
    };
  }
  const diff = current - last;
  const percent = Math.round((diff / last) * 100);
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "same";
  const isGood = isInverseGood ? direction === "down" : direction === "up";
  return {
    text: `${Math.abs(percent)}%`,
    direction,
    icon:
      direction === "up" ? (
        <TrendingUp className="h-4 w-4" />
      ) : direction === "down" ? (
        <TrendingDown className="h-4 w-4" />
      ) : (
        <Minus className="h-4 w-4" />
      ),
    className: direction === "same" ? "text-muted-foreground" : isGood ? "text-primary" : "text-destructive",
  };
}

function formatOverdueChange(current: number, last: number): {
  text: string;
  direction: "up" | "down" | "same";
  icon: React.ReactNode;
  className: string;
} {
  const diff = current - last;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "same";
  const isGood = direction === "down";
  return {
    text: diff > 0 ? `↑ ${diff}건` : diff < 0 ? `↓ ${Math.abs(diff)}건` : "동일",
    direction,
    icon:
      direction === "up" ? (
        <TrendingUp className="h-4 w-4" />
      ) : direction === "down" ? (
        <TrendingDown className="h-4 w-4" />
      ) : (
        <Minus className="h-4 w-4" />
      ),
    className: direction === "same" ? "text-muted-foreground" : isGood ? "text-primary" : "text-destructive",
  };
}

export function DashboardMetrics({ role }: DashboardMetricsProps) {
  const [collapsed, setCollapsed] = useState(getStoredCollapsed);
  const { data, isLoading, error } = useDashboardMetrics(role);

  useEffect(() => {
    setStoredCollapsed(collapsed);
  }, [collapsed]);

  const handleToggle = () => {
    setCollapsed((prev) => !prev);
  };

  const criteriaText = role === "admin" ? "내가 지시한 업무 기준" : "내가 담당한 업무 기준";
  const overdueCriteriaText =
    role === "admin" ? "내가 지시한 업무 기준" : "내 업무(지시자·담당자) 기준";

  const createdLabel = role === "admin" ? "생성 업무" : "할당받은 업무";

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        업무 지표를 불러오는 데 실패했습니다.
      </div>
    );
  }

  const metricsContent = isLoading || !data ? (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-3">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="overflow-hidden">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="mt-2 h-4 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  ) : (
    (() => {
      const createdChange = formatChange(data.createdThisMonth, data.createdLastMonth);
      const approvedChange = formatChange(data.approvedThisMonth, data.approvedLastMonth);
      const avgChange = formatChange(
        data.avgProcessingDaysThisMonth,
        data.avgProcessingDaysLastMonth,
        true,
      );
      const overdueChange = formatOverdueChange(data.overdueCount, data.overdueCountLastMonthEnd);

      const metrics = [
        {
          label: createdLabel,
          value: `${data.createdThisMonth}건`,
          sub: `(지난 달 ${data.createdLastMonth}건)`,
          change: createdChange,
          criteria: criteriaText,
          icon: FilePlus,
        },
        {
          label: "승인 완료",
          value: `${data.approvedThisMonth}건`,
          sub: `(지난 달 ${data.approvedLastMonth}건)`,
          change: approvedChange,
          criteria: criteriaText,
          icon: CheckCircle2,
        },
        {
          label: "평균 처리 소요 시간",
          value: `${data.avgProcessingDaysThisMonth}일`,
          sub: `(지난 달 ${data.avgProcessingDaysLastMonth}일)`,
          change: avgChange,
          criteria: criteriaText,
          icon: Clock,
        },
        {
          label: "마감일 초과 미처리",
          value: `${data.overdueCount}건`,
          sub: `(지난 달 말 ${data.overdueCountLastMonthEnd}건)`,
          change: overdueChange,
          criteria: overdueCriteriaText,
          icon: AlertTriangle,
        },
      ];

      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-3">
          {metrics.map((m, idx) => {
            const IconComponent = m.icon;
            return (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
              >
                <Card className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <span className="text-sm font-medium text-muted-foreground">{m.label}</span>
                    <IconComponent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{m.value}</span>
                    <span className={cn("flex items-center gap-0.5 text-sm font-medium", m.change.className)}>
                      {m.change.icon}
                      {m.change.text}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{m.sub}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground/80">{m.criteria}</p>
                </CardContent>
              </Card>
            </motion.div>
            );
          })}
        </div>
      );
    })()
  );

  return (
    <div className="rounded-lg border bg-card">
      {/* 헤더 바 - 항상 표시, 접기/펼치기 토글 */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">업무 지표</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          {collapsed ? (
            <>
              <ChevronDown className="h-4 w-4" />
              <span>펼치기</span>
            </>
          ) : (
            <>
              <ChevronUp className="h-4 w-4" />
              <span>접기</span>
            </>
          )}
        </Button>
      </div>

      {/* 메트릭 내용 - framer-motion 애니메이션 */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0">{metricsContent}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 접혀 있을 때 요약 표시 (선택) */}
      <AnimatePresence initial={false}>
        {collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t px-4 py-2"
          >
            <p className="text-xs text-muted-foreground">
              이번 달 업무 지표를 한눈에 확인하세요. 펼치기를 클릭해보세요.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
