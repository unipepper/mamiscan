'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EFFECTIVE_DATE = '2026년 4월 22일';

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-12">
      <header className="safe-top sticky top-0 z-50 flex items-center h-14 px-4 bg-bg-surface/80 backdrop-blur-md border-b border-border-subtle">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-1 mr-3 h-8 w-8">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="font-bold text-lg text-text-primary">개인정보처리방침</span>
      </header>

      <main className="px-4 py-6 space-y-8 text-sm text-text-primary leading-relaxed">

        {/* 인트로 */}
        <div className="flex items-start space-x-3 bg-primary/5 border border-primary/15 rounded-2xl p-4">
          <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-text-primary mb-1">마미스캔 개인정보처리방침</p>
            <p className="text-xs text-text-secondary leading-relaxed">
              마미스캔은 이용자의 개인정보를 중요하게 생각하며, 개인정보 보호법 및 관련 법령을 준수합니다.
              본 방침은 이용자의 개인정보가 어떻게 수집·이용·보관·파기되는지 안내합니다.
            </p>
            <p className="text-xs text-text-tertiary mt-2">시행일: {EFFECTIVE_DATE}</p>
          </div>
        </div>

        <Section title="제1조 (개인정보 수집 항목 및 방법)">
          <SubTitle>1. 수집 항목</SubTitle>
          <TableWrap>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-bg">
                  <Th>구분</Th>
                  <Th>항목</Th>
                  <Th>필수 여부</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>회원가입</Td>
                  <Td>이메일 주소, 이름(닉네임)</Td>
                  <Td>필수</Td>
                </tr>
                <tr>
                  <Td>서비스 이용</Td>
                  <Td className="text-danger-fg font-medium">임신 주차 (민감정보·건강 정보)</Td>
                  <Td>선택</Td>
                </tr>
                <tr>
                  <Td>스캔 이용</Td>
                  <Td>업로드 이미지, 바코드 번호, 분석 결과</Td>
                  <Td>서비스 이용 시 자동 수집</Td>
                </tr>
                <tr>
                  <Td>결제</Td>
                  <Td>주문 ID, 결제 금액, 결제 상태 (카드 번호 등 결제 수단 정보는 수탁사가 처리)</Td>
                  <Td>결제 시 자동 생성</Td>
                </tr>
                <tr>
                  <Td>자동 수집</Td>
                  <Td>서비스 이용 기록, 기기 정보(브라우저 유형·OS), 쿠키·세션 토큰</Td>
                  <Td>자동</Td>
                </tr>
              </tbody>
            </table>
          </TableWrap>
          <Notice>
            임신 주차는 건강 관련 민감정보(개인정보 보호법 제23조)에 해당합니다. 해당 정보는 이용자가 직접 입력하는 경우에만 수집되며, 입력하지 않아도 기본 서비스 이용이 가능합니다.
          </Notice>

          <SubTitle>2. 수집 방법</SubTitle>
          <ul className="list-disc pl-5 space-y-1 text-text-secondary">
            <li>소셜 로그인(Google, 카카오) — OAuth 인증 과정에서 이메일·이름 수집</li>
            <li>서비스 이용 중 이용자 직접 입력 (임신 주차, 닉네임)</li>
            <li>카메라 촬영·바코드 스캔 시 자동 수집 (이미지, 바코드)</li>
            <li>결제 과정에서 자동 생성 (주문 ID, 금액, 상태)</li>
          </ul>
        </Section>

        <Section title="제2조 (개인정보의 수집·이용 목적)">
          <p className="text-text-secondary mb-3">마미스캔은 수집된 개인정보를 다음의 목적으로만 이용합니다.</p>
          <ul className="list-disc pl-5 space-y-1.5 text-text-secondary">
            <li><strong className="text-text-primary">서비스 제공</strong>: 임신 주차별 식품 성분 안전성 분석, 대체 제품 추천, 스캔 히스토리 저장</li>
            <li><strong className="text-text-primary">회원 관리</strong>: 회원 식별, 로그인 유지, 계정 보호</li>
            <li><strong className="text-text-primary">결제 및 스캔권 관리</strong>: 결제 처리, 스캔권 부여·관리, 환불 처리</li>
            <li><strong className="text-text-primary">법적 의무 이행</strong>: 관련 법령에 따른 기록 보관, 분쟁 해결</li>
            <li><strong className="text-text-primary">서비스 개선</strong>: 오류 개선 및 서비스 품질 향상 (개인 식별 불가한 집계 데이터만 활용)</li>
          </ul>
          <Notice className="mt-3">
            수집된 개인정보는 광고, 마케팅, 제3자 영리 목적으로 제공·활용되지 않습니다.
          </Notice>
        </Section>

        <Section title="제3조 (개인정보 처리 위탁)">
          <p className="text-text-secondary mb-3">
            서비스 제공을 위해 아래 업체에 개인정보 처리를 위탁합니다.
            위탁받은 업체는 위탁 목적 범위 내에서만 개인정보를 처리합니다.
          </p>
          <TableWrap>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-bg">
                  <Th>수탁자</Th>
                  <Th>위탁 업무</Th>
                  <Th>위탁 항목</Th>
                  <Th>국외 이전</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>Supabase Inc.</Td>
                  <Td>데이터베이스 저장, 파일(이미지) 저장, 인증 관리</Td>
                  <Td>이메일, 닉네임, 임신 주차, 스캔 기록, 스캔 이미지, 거래 기록, 서비스 이용 기록</Td>
                  <Td className="text-caution font-medium">미국</Td>
                </tr>
                <tr>
                  <Td>Google LLC</Td>
                  <Td>AI 성분 분석(Gemini API)</Td>
                  <Td>스캔 이미지, 성분 텍스트 (개인 식별 정보 미포함)</Td>
                  <Td className="text-caution font-medium">미국</Td>
                </tr>
                <tr>
                  <Td>Google LLC</Td>
                  <Td>Google 소셜 로그인</Td>
                  <Td>이메일, 이름</Td>
                  <Td className="text-caution font-medium">미국</Td>
                </tr>
                <tr>
                  <Td>카카오(주)</Td>
                  <Td>카카오 소셜 로그인</Td>
                  <Td>이메일, 이름</Td>
                  <Td>국내</Td>
                </tr>
                <tr>
                  <Td>토스페이먼츠(주)</Td>
                  <Td>결제 처리 및 승인</Td>
                  <Td>주문 ID, 결제 금액 (카드 정보는 토스페이먼츠가 직접 수집)</Td>
                  <Td>국내</Td>
                </tr>
                <tr>
                  <Td>Naver Cloud(주)</Td>
                  <Td>이미지 OCR 처리</Td>
                  <Td>스캔 이미지</Td>
                  <Td>국내</Td>
                </tr>
              </tbody>
            </table>
          </TableWrap>
          <Notice>
            <strong>국외 이전 안내</strong>: Supabase(미국) 및 Google(미국)에 개인정보가 이전됩니다.
            이전 국가는 대한민국과 동등한 수준의 개인정보 보호 체계를 갖추었거나,
            표준 계약 조항(SCC) 등을 통해 적절한 보호 조치가 이루어집니다.
            이에 동의하지 않으실 경우 서비스 이용이 제한될 수 있습니다.
          </Notice>
        </Section>

        <Section title="제4조 (개인정보의 보유·이용 기간 및 파기)">
          <SubTitle>1. 보유 및 이용 기간</SubTitle>
          <TableWrap>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-bg">
                  <Th>항목</Th>
                  <Th>보유 기간</Th>
                  <Th>근거</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>회원 정보(이메일, 닉네임), 임신 주차</Td>
                  <Td>회원 탈퇴 즉시 파기</Td>
                  <Td>목적 달성 즉시 파기 원칙</Td>
                </tr>
                <tr>
                  <Td>스캔 히스토리</Td>
                  <Td>스캔일로부터 <strong className="text-text-primary">90일</strong> 후 자동 삭제<br />(회원 탈퇴 시 즉시 파기)</Td>
                  <Td>서비스 운영 정책</Td>
                </tr>
                <tr>
                  <Td>결제·거래 기록</Td>
                  <Td>5년</Td>
                  <Td>전자상거래법 제6조</Td>
                </tr>
                <tr>
                  <Td>서비스 이용 기록</Td>
                  <Td>3개월</Td>
                  <Td>통신비밀보호법 제15조의2</Td>
                </tr>
                <tr>
                  <Td>소비자 불만·분쟁 기록</Td>
                  <Td>3년</Td>
                  <Td>전자상거래법 제6조</Td>
                </tr>
              </tbody>
            </table>
          </TableWrap>

          <SubTitle>2. 파기 절차 및 방법</SubTitle>
          <ul className="list-disc pl-5 space-y-1 text-text-secondary">
            <li><strong className="text-text-primary">전자적 파일</strong>: 복구 불가능한 방식으로 영구 삭제</li>
            <li><strong className="text-text-primary">파기 시점</strong>: 회원 탈퇴 즉시 파기 (법적 의무 보관 항목 제외)</li>
            <li>결제·거래 기록 등 법령에 따라 보관 의무가 있는 정보는 해당 기간 만료 후 파기</li>
          </ul>
        </Section>

        <Section title="제5조 (이용자 권리 및 행사 방법)">
          <p className="text-text-secondary mb-3">이용자는 언제든지 아래의 권리를 행사할 수 있습니다.</p>
          <ul className="list-disc pl-5 space-y-1.5 text-text-secondary">
            <li><strong className="text-text-primary">열람 요청</strong>: 본인의 개인정보 처리 현황 열람</li>
            <li><strong className="text-text-primary">정정·삭제 요청</strong>: 잘못된 정보의 정정 또는 삭제</li>
            <li><strong className="text-text-primary">처리 정지 요청</strong>: 개인정보 처리의 일시 정지</li>
            <li><strong className="text-text-primary">동의 철회</strong>: 수집·이용 동의 철회 (단, 서비스 이용이 제한될 수 있음)</li>
          </ul>
          <p className="text-text-secondary mt-3">
            권리 행사는 <strong className="text-text-primary">앱 내 고객센터</strong> 또는 이메일(<strong className="text-text-primary">mamiscan2026@gmail.com</strong>)로 요청하시면 됩니다.
            요청 접수 후 <strong className="text-text-primary">10일 이내</strong>에 처리 결과를 안내드립니다.
          </p>
          <p className="text-text-secondary mt-2">
            회원 탈퇴는 앱 내 설정 → [탈퇴하기]에서 직접 진행할 수 있습니다.
            탈퇴 시 관련 데이터는 위 보유 기간 기준으로 순차 파기됩니다.
          </p>
        </Section>

        <Section title="제6조 (쿠키 및 자동 수집 장치)">
          <p className="text-text-secondary mb-2">
            마미스캔은 로그인 세션 유지 목적으로 쿠키 및 로컬 스토리지를 사용합니다.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-text-secondary">
            <li><strong className="text-text-primary">세션 쿠키</strong>: 로그인 상태 유지 (브라우저 종료 시 만료)</li>
            <li><strong className="text-text-primary">로컬 스토리지</strong>: 비로그인 게스트 스캔 횟수 임시 저장</li>
          </ul>
          <p className="text-text-secondary mt-2">
            브라우저 설정에서 쿠키를 거부하거나 삭제할 수 있으나, 이 경우 로그인 유지 등 일부 서비스 기능이 제한될 수 있습니다.
          </p>
        </Section>

        <Section title="제7조 (개인정보 안전성 확보 조치)">
          <ul className="list-disc pl-5 space-y-1.5 text-text-secondary">
            <li><strong className="text-text-primary">접근 제어</strong>: Supabase Row Level Security(RLS)로 다른 이용자의 데이터에 접근 불가</li>
            <li><strong className="text-text-primary">전송 보안</strong>: HTTPS(TLS) 암호화 통신</li>
            <li><strong className="text-text-primary">인증</strong>: JWT 기반 세션 관리, OAuth 2.0 소셜 로그인</li>
            <li><strong className="text-text-primary">최소 수집</strong>: 서비스 목적에 필요한 최소한의 정보만 수집</li>
            <li><strong className="text-text-primary">API 키 관리</strong>: 서버 사이드에서만 처리, 클라이언트에 노출되지 않음</li>
          </ul>
        </Section>

        <Section title="제8조 (만 14세 미만 아동 보호)">
          <p className="text-text-secondary">
            마미스캔은 만 14세 미만 아동을 대상으로 하지 않으며, 만 14세 미만 아동의 개인정보를 의도적으로 수집하지 않습니다.
            만 14세 미만 이용자의 가입이 확인될 경우 즉시 계정 및 관련 정보를 파기합니다.
          </p>
        </Section>

        <Section title="제9조 (개인정보 보호 책임자)">
          <p className="text-text-secondary mb-3">
            개인정보 관련 문의, 불만 처리, 피해 구제 등에 관한 사항은 아래 담당자에게 연락하시기 바랍니다.
          </p>
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 space-y-1.5">
            <Row label="서비스명" value="마미스캔 (MamiScan)" />
            <Row label="책임자" value="허윤희 (대표)" />
            <Row label="문의 방법" value="앱 내 고객센터 또는 mamiscan2026@gmail.com" />
            <Row label="처리 기간" value="문의 접수 후 10일 이내" />
          </div>
          <p className="text-xs text-text-tertiary mt-3 leading-relaxed">
            개인정보 침해 신고 및 상담: 개인정보보호위원회 (privacy.go.kr / 국번없이 182),
            개인정보 분쟁조정위원회 (kopico.go.kr / 1833-6972)
          </p>
        </Section>

        <Section title="제10조 (개인정보처리방침 변경 공지)">
          <p className="text-text-secondary">
            본 방침은 법령·서비스 변경에 따라 개정될 수 있습니다.
            중요한 내용이 변경될 경우 시행일로부터 최소 <strong className="text-text-primary">7일 전</strong>에 서비스 내 공지사항 또는 이메일을 통해 안내합니다.
          </p>
          <p className="text-text-secondary mt-2">
            공지 후 변경 시행일까지 별도의 의사 표시가 없으면 <strong className="text-text-primary">변경에 동의한 것으로 간주</strong>합니다.
            동의하지 않으시는 경우, 변경 시행일 이전에 회원 탈퇴 또는 고객센터(mamiscan2026@gmail.com)로 문의해 주세요.
          </p>
        </Section>

        <div className="pt-2 pb-4 text-center text-xs text-text-tertiary">
          시행일: {EFFECTIVE_DATE}
          <br />
          이전 버전의 개인정보처리방침은 고객센터를 통해 확인하실 수 있습니다.
        </div>
      </main>
    </div>
  );
}

/* ── 내부 컴포넌트 ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-text-primary border-b border-border-subtle pb-2">{title}</h2>
      {children}
    </section>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <p className="font-semibold text-text-primary mt-2">{children}</p>;
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle">
      {children}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-3 py-2 font-semibold text-text-primary border-b border-border-subtle whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-3 py-2.5 border-b border-border-subtle align-top text-text-secondary ${className ?? ''}`}>
      {children}
    </td>
  );
}

function Notice({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-caution/8 border border-caution/20 rounded-xl p-3 mt-2 ${className ?? ''}`}>
      <p className="text-xs text-text-secondary leading-relaxed">{children}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-text-tertiary w-16 shrink-0">{label}</span>
      <span className="text-text-primary font-medium">{value}</span>
    </div>
  );
}
