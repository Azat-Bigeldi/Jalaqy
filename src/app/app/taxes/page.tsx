import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Badge,
  Banner,
  buttonClasses,
  ButtonLink,
  Card,
  EmptyState,
  KpiTile,
  PageHeader,
  StatusPill,
  Table,
  type TableColumn,
} from "@/components/ui";
import { IconChart, IconDownload } from "@/components/ui/icons";
import { interpolate, t } from "@/i18n";
import { api } from "@/lib/api";
import type { TaxPayment, TaxReport } from "@/lib/api/contracts";
import { currentPeriod, daysUntil } from "@/lib/clock";
import { formatCount, formatDate, formatNumber, monthName } from "@/lib/format";
import { isSupportedPeriod, parsePeriod, shiftPeriod } from "@/lib/period";
import { supportedYears } from "@/lib/payroll";
import { requireSession } from "@/lib/session";
import { PageSkeleton } from "../_components/PageSkeleton";
import { ConfirmlessButton } from "../_components/ConfirmlessButton";
import { MonthLink } from "../_components/MonthLink";
import { setReportSubmittedAction } from "./actions";
import { MarkPaidButton } from "./MarkPaidButton";

const tx = t.taxes;
const mt = t.manage.taxes;

export const metadata: Metadata = { title: tx.title };

function quarterLabel(quarter: string) {
  const [year, q] = quarter.split("-Q");
  return interpolate(tx.quarter, { q: tx.quarters[Number(q) - 1] ?? q ?? "", year: year ?? "" });
}

function reportBadge(r: TaxReport) {
  const label = t.domain.reportStatus[r.status];
  if (r.status === "submitted") return <StatusPill status="paid">{label}</StatusPill>;
  if (r.status === "ready") return <StatusPill status="pending">{label}</StatusPill>;
  return <Badge tone="neutral">{label}</Badge>;
}

async function TaxesView({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireSession(["accountant", "owner"]);
  const sp = await searchParams;
  const period = isSupportedPeriod(sp.period, supportedYears()) ? sp.period : currentPeriod();
  const monthNav = (
    <div className="flex items-center gap-1.5">
      <MonthLink
        period={period}
        dir={-1}
        path="/app/taxes"
        disabled={!isSupportedPeriod(shiftPeriod(period, -1), supportedYears())}
      />
      <MonthLink period={period} dir={1} path="/app/taxes" disabled={period >= currentPeriod()} />
    </div>
  );
  const [payments, reports] = await Promise.all([api.taxes.payments(period), api.taxes.reports()]);
  const { monthIndex, year } = parsePeriod(period);
  const month = monthName(monthIndex);

  const sum = (f: (p: TaxPayment) => boolean) =>
    payments.filter(f).reduce((s, p) => s + p.amount, 0);
  const total = sum(() => true);
  const unpaid = sum((p) => p.status === "unpaid");
  const due = payments[0]?.dueDate ?? `${period}-25`;
  const left = daysUntil(due);

  const columns: TableColumn<TaxPayment>[] = [
    {
      key: "name",
      header: tx.payment,
      render: (p) => {
        const [short, long] = t.domain.taxKinds[p.kind];
        return (
          <>
            <div className="font-semibold">{short}</div>
            <div className="text-caption text-muted">
              {long} · {t.domain.payer[p.payer]}
            </div>
          </>
        );
      },
    },
    {
      key: "amount",
      header: tx.amount,
      align: "right",
      emphasis: true,
      render: (p) => formatNumber(p.amount),
    },
    {
      key: "due",
      header: tx.due,
      align: "right",
      render: (p) => formatDate(p.dueDate, "dayMonth"),
    },
    {
      key: "status",
      header: tx.status,
      render: (p) =>
        p.status === "paid" ? (
          <StatusPill status="paid">{t.domain.taxStatus.paid}</StatusPill>
        ) : (
          <Badge tone="warning">{t.domain.taxStatus.unpaid}</Badge>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{tx.actions}</span>,
      align: "right",
      render: (p) => {
        const [short] = t.domain.taxKinds[p.kind];
        return (
          <span className="flex justify-end gap-1">
            <a
              href={`/api/payments/${encodeURIComponent(p.id)}`}
              download
              aria-label={interpolate(tx.orderLabel, { name: short })}
              className={buttonClasses({ variant: "ghost", size: "md" })}
            >
              <IconDownload size={18} />
              {tx.order}
            </a>
            {p.status === "unpaid" && (
              <MarkPaidButton id={p.id} label={interpolate(tx.markPaidLabel, { name: short })} />
            )}
          </span>
        );
      },
    },
  ];

  if (total === 0) {
    return (
      <>
        <PageHeader
          title={tx.title}
          meta={interpolate(tx.meta, { month: `${month} ${year}` })}
          actions={monthNav}
        />
        <EmptyState
          icon={<IconChart size={26} />}
          title={interpolate(tx.empty.title, { month })}
          action={<ButtonLink href="/app/employees">{tx.empty.action}</ButtonLink>}
        >
          {tx.empty.text}
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={tx.title}
        meta={interpolate(tx.meta, { month: `${month} ${year}` })}
        actions={monthNav}
      />
      {unpaid > 0 ? (
        <Banner
          tone="warning"
          title={interpolate(tx.banner, { month, date: formatDate(due, "dayMonth") })}
        >
          {left >= 0 && interpolate(tx.bannerDays, { days: formatCount(left, t.plural.days) })}
        </Banner>
      ) : (
        <Banner tone="success" title={interpolate(tx.bannerPaid, { month })} />
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <KpiTile tone="ink" label={tx.kpi.total} value={total} />
        <KpiTile label={tx.kpi.withheld} value={sum((p) => p.payer === "employee")} />
        <KpiTile label={tx.kpi.employer} value={sum((p) => p.payer === "employer")} />
      </div>
      <section aria-labelledby="tx-payments" className="flex flex-col gap-3">
        <h2 id="tx-payments" className="font-display text-xl font-bold tracking-display">
          {tx.payments}
        </h2>
        <Table
          caption={interpolate(tx.paymentsCaption, { month: `${month} ${year}` })}
          columns={columns}
          rows={payments}
          rowKey={(p) => p.id}
          minWidth={860}
        />
        <p className="text-caption text-muted">{tx.note}</p>
      </section>
      <section aria-labelledby="tx-reports" className="flex flex-col gap-3">
        <h2 id="tx-reports" className="font-display text-xl font-bold tracking-display">
          {tx.reports}
        </h2>
        <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
          {reports.map((r) => (
            <Card
              as="li"
              key={r.id}
              padding="md"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">
                  {interpolate(tx.reportTitle, { form: r.form, quarter: quarterLabel(r.quarter) })}
                </span>
                <span className="text-sm text-muted">
                  {interpolate(tx.reportDue, { date: formatDate(r.dueDate) })}
                </span>
              </div>
              <span className="flex flex-wrap items-center gap-2">
                {reportBadge(r)}
                {r.status !== "not_ready" && (
                  <ConfirmlessButton
                    variant="ghost"
                    action={setReportSubmittedAction.bind(null, r.id, r.status !== "submitted")}
                    done={mt.reportToggled}
                    label={interpolate(mt.reportLabel, {
                      action: r.status === "submitted" ? mt.unsubmit : mt.submit,
                      quarter: quarterLabel(r.quarter),
                    })}
                  >
                    {r.status === "submitted" ? mt.unsubmit : mt.submit}
                  </ConfirmlessButton>
                )}
              </span>
            </Card>
          ))}
        </ul>
      </section>
    </>
  );
}

export default function TaxesPage({ searchParams }: PageProps<"/app/taxes">) {
  return (
    <Suspense fallback={<PageSkeleton rows={7} />}>
      <TaxesView searchParams={searchParams as Promise<{ period?: string }>} />
    </Suspense>
  );
}
