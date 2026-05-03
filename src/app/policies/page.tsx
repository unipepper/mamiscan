'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, FileText, Shield } from 'lucide-react';

const TERMS_DATE = '2026년 4월 18일';
const PRIVACY_DATE = '2026년 4월 22일';

type Tab = 'terms' | 'privacy';

export default function PoliciesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('terms');

  return (
    <div className="flex flex-col flex-1 bg-bg-canvas pb-12">
      <header className="safe-top sticky top-0 z-50 bg-bg-surface/80 backdrop-blur-md border-b border-border-subtle">
        <div className="flex items-center h-14 px-4">
          <button
            onClick={() => router.back()}
            className="p-1 -ml-1 mr-3 text-text-secondary hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-lg text-text-primary">약관 및 방침</span>
        </div>
        {/* 탭 */}
        <div className="flex px-4 gap-6">
          <button
            onClick={() => setActiveTab('terms')}
            className={`flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'terms'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            <FileText className="w-4 h-4" />
            이용약관
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'privacy'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            <Shield className="w-4 h-4" />
            개인정보처리방침
          </button>
        </div>
      </header>

      <main className="px-4 py-6 space-y-8 text-sm text-text-primary leading-relaxed">
        {activeTab === 'terms' ? <TermsContent /> : <PrivacyContent />}
      </main>
    </div>
  );
}

/* ── 이용약관 콘텐츠 ── */

function TermsContent() {
  return (
    <>
      <div className="flex items-start space-x-3 bg-primary/5 border border-primary/15 rounded-2xl p-4">
        <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-text-primary mb-1">마미스캔 이용약관</p>
          <p className="text-xs text-text-secondary leading-relaxed">
            본 약관은 마미스캔(이하 "서비스")의 이용 조건 및 절차, 회사와 이용자 간의 권리·의무 관계를 규정합니다.
            서비스를 이용하시기 전에 본 약관을 주의 깊게 읽어 주시기 바랍니다.
          </p>
          <p className="text-xs text-text-tertiary mt-2">시행일: {TERMS_DATE}</p>
        </div>
      </div>

      <Section title="제1조 (목적)">
        <p className="text-text-secondary">
          본 약관은 유니페퍼(이하 "회사")가 제공하는 마미스캔 서비스(이하 "서비스")의 이용과 관련하여
          회사와 이용자 간의 권리·의무 및 책임 사항, 서비스 이용 조건 및 절차 등 기본적인 사항을 규정함을 목적으로 합니다.
        </p>
      </Section>

      <Section title="제2조 (용어의 정의)">
        <p className="text-text-secondary mb-3">본 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
        <ol className="list-decimal pl-5 space-y-2 text-text-secondary">
          <li><strong className="text-text-primary">"서비스"</strong>란 마미스캔 웹 앱을 통해 제공되는 임신 주차별 식품·제품 성분 안전성 분석, 바코드 스캔, 스캔 히스토리 등 일체의 서비스를 말합니다.</li>
          <li><strong className="text-text-primary">"회원"</strong>이란 소셜 로그인(Google, Kakao)을 통해 이용계약을 체결하고 서비스를 이용하는 자를 말합니다.</li>
          <li><strong className="text-text-primary">"비회원(게스트)"</strong>이란 회원 가입 없이 제한된 범위 내에서 서비스를 이용하는 자를 말합니다.</li>
          <li><strong className="text-text-primary">"유료서비스"</strong>란 5회 스캔권, 무제한 스캔권 등 결제를 통해 이용하는 서비스를 말합니다.</li>
          <li><strong className="text-text-primary">"스캔권"</strong>이란 스캔 서비스 이용에 사용되는 패스를 말하며, <strong className="text-text-primary">"5회 스캔권"</strong>은 유효기간(14일) 내 5회 사용 가능한 유한 크레딧, <strong className="text-text-primary">"무제한 스캔권"</strong>은 30일간 횟수 제한 없이 사용 가능한 패스입니다.</li>
          <li><strong className="text-text-primary">"콘텐츠"</strong>란 서비스를 통해 제공되는 AI 분석 결과, 성분 정보, 이미지, 텍스트 등 일체의 정보를 말합니다.</li>
        </ol>
      </Section>

      <Section title="제3조 (약관의 효력 및 변경)">
        <ol className="list-decimal pl-5 space-y-2 text-text-secondary">
          <li>본 약관은 서비스 내 공지 또는 회원 가입 화면에 게시함으로써 효력이 발생합니다.</li>
          <li>회사는 필요한 경우 관련 법령을 위반하지 않는 범위 내에서 본 약관을 변경할 수 있습니다.</li>
          <li>약관이 변경되는 경우, 회사는 변경 내용 및 시행일을 <strong className="text-text-primary">시행일로부터 최소 7일 전</strong>(중요한 변경의 경우 30일 전)에 서비스 내 공지사항 또는 이메일을 통해 공지합니다.</li>
          <li>이용자가 변경된 약관의 시행일까지 거부 의사를 표시하지 않으면 변경에 동의한 것으로 간주합니다. 변경 약관에 동의하지 않는 경우, 이용자는 서비스 이용을 중단하고 탈퇴할 수 있습니다.</li>
        </ol>
      </Section>

      <Section title="제4조 (서비스의 제공 및 변경)">
        <SubTitle>1. 제공 서비스</SubTitle>
        <ul className="list-disc pl-5 space-y-1.5 text-text-secondary">
          <li>바코드 스캔 및 AI 기반 식품·제품 성분 안전성 분석</li>
          <li>임신 주차별 맞춤 안전성 등급 및 성분 위험도 안내</li>
          <li>대체 제품 추천</li>
          <li>스캔 히스토리 저장 및 조회 (회원 전용)</li>
          <li>유료 스캔권 팩 및 월정액 구독 서비스</li>
        </ul>
        <SubTitle>2. 서비스 변경 및 중단</SubTitle>
        <ol className="list-decimal pl-5 space-y-2 text-text-secondary mt-2">
          <li>회사는 서비스의 내용, 이용 방법 등을 변경할 수 있으며, 변경 내용은 사전에 공지합니다.</li>
          <li>회사는 서버 점검, 시스템 장애, 천재지변 등 불가피한 사유로 서비스를 일시적으로 중단할 수 있으며, 이 경우 사전 또는 사후에 공지합니다.</li>
          <li>서비스 중단으로 인한 손해에 대해 회사는 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.</li>
        </ol>
      </Section>

      <Section title="제5조 (이용계약 체결)">
        <ol className="list-decimal pl-5 space-y-2 text-text-secondary">
          <li>이용계약은 이용자가 소셜 로그인(Google, Kakao)을 통해 회원 가입을 완료하고 본 약관에 동의함으로써 체결됩니다.</li>
          <li>만 14세 미만은 서비스를 이용할 수 없습니다. 만 14세 미만 이용자의 가입이 확인되는 경우, 회사는 해당 계정을 즉시 삭제할 수 있습니다.</li>
          <li>다음에 해당하는 경우, 회사는 이용 신청을 거부하거나 이후 이용계약을 해지할 수 있습니다.
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>허위 또는 타인의 정보로 가입한 경우</li>
              <li>이전에 약관 위반으로 이용 제한된 이용자가 재가입을 시도하는 경우</li>
              <li>기타 본 약관을 위반할 우려가 있다고 회사가 판단하는 경우</li>
            </ul>
          </li>
        </ol>
      </Section>

      <Section title="제6조 (회원 탈퇴 및 자격 상실)">
        <ol className="list-decimal pl-5 space-y-2 text-text-secondary">
          <li>회원은 언제든지 앱 내 <strong className="text-text-primary">설정 → [탈퇴하기]</strong> 또는 이메일(mamiscan2026@gmail.com)을 통해 탈퇴를 요청할 수 있습니다.</li>
          <li>탈퇴 즉시 회원 정보, 스캔 히스토리, 임신 주차 등 개인정보는 파기됩니다. 단, 관련 법령에 따라 보관 의무가 있는 결제·거래 기록 등은 해당 기간 동안 보관됩니다.</li>
          <li>탈퇴 시 미사용 스캔권 및 잔여 구독 기간은 환불 규정(제10조)에 따릅니다.</li>
          <li>회사는 이용자가 본 약관을 위반한 경우 사전 통보 없이 이용계약을 해지하고 서비스 이용을 제한할 수 있습니다.</li>
        </ol>
      </Section>

      <Section title="제7조 (서비스 이용 제한)">
        <SubTitle>1. 금지 행위</SubTitle>
        <p className="text-text-secondary mt-1 mb-2">이용자는 다음 행위를 해서는 안 됩니다.</p>
        <ul className="list-disc pl-5 space-y-1.5 text-text-secondary">
          <li>자동화 도구, 봇, 스크립트 등을 이용한 스캔 자동화 또는 크롤링</li>
          <li>서비스 API의 무단 호출 또는 역공학(리버스 엔지니어링)</li>
          <li>타인의 계정 도용 또는 허위 정보를 이용한 가입</li>
          <li>고의적인 허위 오류 신고로 서비스를 방해하는 행위</li>
          <li>서비스 내 콘텐츠를 무단으로 복제·배포·상업적으로 이용하는 행위</li>
          <li>관련 법령 또는 공서양속에 반하는 행위</li>
        </ul>
        <SubTitle>2. 제재 조치</SubTitle>
        <p className="text-text-secondary mt-1">위반 행위의 경중에 따라 <strong className="text-text-primary">경고 → 일시 정지 → 영구 정지</strong> 순으로 제재합니다. 불법 행위의 경우 법적 조치를 취할 수 있습니다.</p>
      </Section>

      <Section title="제8조 (게스트 이용)">
        <ol className="list-decimal pl-5 space-y-2 text-text-secondary">
          <li>비회원(게스트)은 로그인 없이 <strong className="text-text-primary">3회의 무료 스캔</strong>을 이용할 수 있습니다.</li>
          <li>게스트 스캔 횟수는 브라우저 로컬 스토리지에 저장되며, 브라우저 데이터 삭제 시 초기화될 수 있습니다.</li>
          <li>게스트 이용 시 스캔 기록이 저장되지 않으며, 유료서비스 결제 및 히스토리 조회가 불가합니다.</li>
        </ol>
      </Section>

      <Section title="제9조 (유료서비스 이용)">
        <SubTitle>1. 유료서비스 종류 및 가격</SubTitle>
        <TableWrap>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-bg">
                <Th>상품명</Th><Th>내용</Th><Th>금액</Th><Th>유효기간</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td>스캔 스캔권 팩</Td><Td>스캔 5회</Td><Td>1,800원</Td><Td>구매일로부터 14일</Td>
              </tr>
              <tr>
                <Td>월정액 구독</Td><Td>스캔 무제한</Td><Td>5,800원</Td><Td>구매일로부터 30일</Td>
              </tr>
            </tbody>
          </table>
        </TableWrap>
        <Notice>가격은 사전 공지 후 변경될 수 있습니다. 자동 갱신은 제공되지 않으며, 원하시는 경우 만료 후 수동으로 재구매하실 수 있습니다.</Notice>
        <SubTitle>2. 결제 방법</SubTitle>
        <p className="text-text-secondary mt-1">결제는 토스페이먼츠(주)를 통해 처리되며, 신용카드, 체크카드, 간편결제 등을 이용할 수 있습니다. 실제 결제 처리 및 카드 정보는 토스페이먼츠가 직접 관리합니다.</p>
      </Section>

      <Section title="제10조 (청약철회 및 환불)">
        <ol className="list-decimal pl-5 space-y-2.5 text-text-secondary">
          <li><strong className="text-text-primary">청약철회 가능 기간</strong>: 구매일로부터 <strong className="text-text-primary">7일 이내</strong>에 청약철회를 요청할 수 있습니다. (전자상거래 등에서의 소비자보호에 관한 법률 제17조 기준)</li>
          <li><strong className="text-text-primary">청약철회 불가 사유</strong>: 다음의 경우 청약철회가 제한됩니다.
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>스캔권 팩 구매 후 <strong className="text-text-primary">1회라도 스캔 서비스를 이용한 경우</strong></li>
              <li>월정액 구독 기간이 만료된 경우</li>
              <li>스캔권 유효기간이 만료된 경우</li>
            </ul>
          </li>
          <li><strong className="text-text-primary">부분 환불</strong>: 스캔권 팩을 일부만 사용한 경우, 사용하지 않은 잔여 스캔권에 대해 비례 환불을 검토할 수 있습니다.</li>
          <li><strong className="text-text-primary">환불 신청 방법</strong>: 이메일(mamiscan2026@gmail.com)로 요청하시면 <strong className="text-text-primary">3영업일 이내</strong>에 처리 결과를 안내드립니다.</li>
        </ol>
        <Notice>디지털 콘텐츠(스캔 서비스)의 특성상 서비스 이용 시작 후에는 청약철회가 제한될 수 있습니다. 구매 전 서비스 내용을 충분히 확인하시기 바랍니다.</Notice>
      </Section>

      <Section title="제11조 (AI 분석 결과의 한계 및 의료정보 면책)">
        <Notice className="border-danger/20 bg-danger/5">
          <strong className="text-danger-fg">중요 안내</strong>: 마미스캔이 제공하는 성분 분석 결과는 참고 정보이며, 의료적 진단·처방·치료를 대체하지 않습니다.
        </Notice>
        <ol className="list-decimal pl-5 space-y-2.5 text-text-secondary mt-3">
          <li>서비스에서 제공하는 성분 안전성 분석, 위험도 등급 등 모든 정보는 <strong className="text-text-primary">의료적 진단·처방이 아니며</strong>, 건강 관련 결정의 최종 판단은 이용자 본인의 책임입니다.</li>
          <li>분석 결과는 식품의약품안전처 공공데이터 및 AI 모델을 기반으로 제공되나, <strong className="text-text-primary">정확성을 100% 보장하지 않습니다</strong>.</li>
          <li>임신 중 식품·제품 섭취에 대한 우려가 있는 경우, <strong className="text-text-primary">반드시 담당 의사 또는 산부인과 전문의와 상담</strong>하시기 바랍니다.</li>
          <li>이용자가 입력한 임신 주차가 부정확하거나 누락된 경우, 분석 결과가 실제와 다를 수 있으며 이에 대한 책임은 이용자에게 있습니다.</li>
        </ol>
      </Section>

      <Section title="제12조 (저작권 및 지식재산권)">
        <ol className="list-decimal pl-5 space-y-2 text-text-secondary">
          <li>서비스 내 제공되는 콘텐츠의 저작권 및 지식재산권은 회사에 귀속됩니다.</li>
          <li>이용자가 서비스 내에 업로드한 이미지는 서비스 제공 및 품질 개선 목적으로만 활용되며, 이용자의 동의 없이 제3자에게 제공되지 않습니다.</li>
          <li>이용자는 회사의 사전 동의 없이 서비스 내 콘텐츠를 복제·배포·판매하거나 상업적 목적으로 이용할 수 없습니다.</li>
        </ol>
      </Section>

      <Section title="제13조 (면책조항)">
        <ol className="list-decimal pl-5 space-y-2 text-text-secondary">
          <li>회사는 천재지변, 이용자 귀책, 제3자 서비스 장애 등의 경우 서비스 제공 의무를 면합니다.</li>
          <li>회사는 이용자가 서비스를 통해 얻은 정보의 신뢰성에 대해 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.</li>
          <li>이용자의 임신 주차 오기입 등 이용자 부주의로 인한 결과에 대해 회사는 책임을 지지 않습니다.</li>
        </ol>
      </Section>

      <Section title="제14조 (분쟁 해결 및 준거법)">
        <ol className="list-decimal pl-5 space-y-2 text-text-secondary">
          <li>분쟁이 발생한 경우, 회사와 이용자는 상호 협의를 통해 해결하도록 노력합니다.</li>
          <li>협의가 이루어지지 않는 경우, 소비자분쟁조정위원회에 조정을 신청하거나 관할법원에 소를 제기할 수 있습니다.</li>
          <li>본 약관에는 <strong className="text-text-primary">대한민국 법률</strong>이 적용되며, 관할법원은 <strong className="text-text-primary">서울중앙지방법원</strong>을 제1심으로 합니다.</li>
        </ol>
      </Section>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-text-primary border-b border-border-subtle pb-2">회사 정보</h2>
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 space-y-1.5">
          <Row label="서비스명" value="마미스캔 (MamiScan)" />
          <Row label="회사명" value="유니페퍼" />
          <Row label="대표자" value="허윤희" />
          <Row label="문의" value="mamiscan2026@gmail.com" />
          <Row label="처리 기간" value="문의 접수 후 3영업일 이내" />
        </div>
      </section>

      <div className="pt-2 pb-4 text-center text-xs text-text-tertiary">
        <p>부칙: 본 약관은 {TERMS_DATE}부터 시행합니다.</p>
      </div>
    </>
  );
}

/* ── 개인정보처리방침 콘텐츠 ── */

function PrivacyContent() {
  return (
    <>
      <div className="flex items-start space-x-3 bg-primary/5 border border-primary/15 rounded-2xl p-4">
        <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-text-primary mb-1">마미스캔 개인정보처리방침</p>
          <p className="text-xs text-text-secondary leading-relaxed">
            마미스캔은 이용자의 개인정보를 중요하게 생각하며, 개인정보 보호법 및 관련 법령을 준수합니다.
            본 방침은 이용자의 개인정보가 어떻게 수집·이용·보관·파기되는지 안내합니다.
          </p>
          <p className="text-xs text-text-tertiary mt-2">시행일: {PRIVACY_DATE}</p>
        </div>
      </div>

      <Section title="제1조 (개인정보 수집 항목 및 방법)">
        <SubTitle>1. 수집 항목</SubTitle>
        <TableWrap>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-bg">
                <Th>구분</Th><Th>항목</Th><Th>필수 여부</Th>
              </tr>
            </thead>
            <tbody>
              <tr><Td>회원가입</Td><Td>이메일 주소, 이름(닉네임)</Td><Td>필수</Td></tr>
              <tr><Td>서비스 이용</Td><Td className="text-danger-fg font-medium">임신 주차 (민감정보·건강 정보)</Td><Td>선택</Td></tr>
              <tr><Td>스캔 이용</Td><Td>업로드 이미지, 바코드 번호, 분석 결과</Td><Td>자동 수집</Td></tr>
              <tr><Td>결제</Td><Td>주문 ID, 결제 금액, 결제 상태</Td><Td>자동 생성</Td></tr>
              <tr><Td>자동 수집</Td><Td>서비스 이용 기록, 기기 정보, 쿠키·세션 토큰</Td><Td>자동</Td></tr>
            </tbody>
          </table>
        </TableWrap>
        <Notice>임신 주차는 건강 관련 민감정보(개인정보 보호법 제23조)에 해당합니다. 입력하지 않아도 기본 서비스 이용이 가능합니다.</Notice>
        <SubTitle>2. 수집 방법</SubTitle>
        <ul className="list-disc pl-5 space-y-1 text-text-secondary">
          <li>소셜 로그인(Google, 카카오) — OAuth 인증 과정에서 이메일·이름 수집</li>
          <li>서비스 이용 중 이용자 직접 입력 (임신 주차, 닉네임)</li>
          <li>카메라 촬영·바코드 스캔 시 자동 수집 (이미지, 바코드)</li>
          <li>결제 과정에서 자동 생성 (주문 ID, 금액, 상태)</li>
        </ul>
      </Section>

      <Section title="제2조 (개인정보의 수집·이용 목적)">
        <ul className="list-disc pl-5 space-y-1.5 text-text-secondary">
          <li><strong className="text-text-primary">서비스 제공</strong>: 임신 주차별 식품 성분 안전성 분석, 스캔 히스토리 저장</li>
          <li><strong className="text-text-primary">회원 관리</strong>: 회원 식별, 로그인 유지, 계정 보호</li>
          <li><strong className="text-text-primary">결제 및 스캔권 관리</strong>: 결제 처리, 스캔권 부여·관리, 환불 처리</li>
          <li><strong className="text-text-primary">법적 의무 이행</strong>: 관련 법령에 따른 기록 보관, 분쟁 해결</li>
          <li><strong className="text-text-primary">서비스 개선</strong>: 오류 개선 및 서비스 품질 향상 (개인 식별 불가한 집계 데이터만 활용)</li>
        </ul>
        <Notice className="mt-3">수집된 개인정보는 광고, 마케팅, 제3자 영리 목적으로 제공·활용되지 않습니다.</Notice>
      </Section>

      <Section title="제3조 (개인정보 처리 위탁)">
        <TableWrap>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-bg">
                <Th>수탁자</Th><Th>위탁 업무</Th><Th>국외 이전</Th>
              </tr>
            </thead>
            <tbody>
              <tr><Td>Supabase Inc.</Td><Td>DB 저장, 파일 저장, 인증 관리</Td><Td className="text-caution font-medium">미국</Td></tr>
              <tr><Td>Google LLC</Td><Td>AI 성분 분석(Gemini API), 소셜 로그인</Td><Td className="text-caution font-medium">미국</Td></tr>
              <tr><Td>카카오(주)</Td><Td>카카오 소셜 로그인</Td><Td>국내</Td></tr>
              <tr><Td>토스페이먼츠(주)</Td><Td>결제 처리 및 승인</Td><Td>국내</Td></tr>
              <tr><Td>Naver Cloud(주)</Td><Td>이미지 OCR 처리</Td><Td>국내</Td></tr>
            </tbody>
          </table>
        </TableWrap>
        <Notice><strong>국외 이전 안내</strong>: Supabase(미국) 및 Google(미국)에 개인정보가 이전됩니다. 표준 계약 조항(SCC) 등을 통해 적절한 보호 조치가 이루어집니다.</Notice>
      </Section>

      <Section title="제4조 (개인정보의 보유·이용 기간 및 파기)">
        <TableWrap>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-bg">
                <Th>항목</Th><Th>보유 기간</Th><Th>근거</Th>
              </tr>
            </thead>
            <tbody>
              <tr><Td>회원 정보, 임신 주차</Td><Td>탈퇴 즉시 파기</Td><Td>목적 달성 즉시 파기</Td></tr>
              <tr><Td>스캔 히스토리</Td><Td>스캔일로부터 90일</Td><Td>서비스 운영 정책</Td></tr>
              <tr><Td>결제·거래 기록</Td><Td>5년</Td><Td>전자상거래법 제6조</Td></tr>
              <tr><Td>서비스 이용 기록</Td><Td>3개월</Td><Td>통신비밀보호법</Td></tr>
              <tr><Td>소비자 불만·분쟁 기록</Td><Td>3년</Td><Td>전자상거래법 제6조</Td></tr>
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Section title="제5조 (이용자 권리 및 행사 방법)">
        <ul className="list-disc pl-5 space-y-1.5 text-text-secondary">
          <li><strong className="text-text-primary">열람·정정·삭제 요청</strong>: 본인의 개인정보 열람 및 잘못된 정보의 정정 또는 삭제</li>
          <li><strong className="text-text-primary">처리 정지 요청</strong>: 개인정보 처리의 일시 정지</li>
          <li><strong className="text-text-primary">동의 철회</strong>: 수집·이용 동의 철회 (단, 서비스 이용이 제한될 수 있음)</li>
        </ul>
        <p className="text-text-secondary mt-3">앱 내 고객센터 또는 이메일(<strong className="text-text-primary">mamiscan2026@gmail.com</strong>)로 요청하시면 <strong className="text-text-primary">10일 이내</strong>에 처리 결과를 안내드립니다.</p>
      </Section>

      <Section title="제6조 (쿠키 및 자동 수집 장치)">
        <ul className="list-disc pl-5 space-y-1 text-text-secondary">
          <li><strong className="text-text-primary">세션 쿠키</strong>: 로그인 상태 유지 (브라우저 종료 시 만료)</li>
          <li><strong className="text-text-primary">로컬 스토리지</strong>: 비로그인 게스트 스캔 횟수 임시 저장</li>
        </ul>
      </Section>

      <Section title="제7조 (개인정보 안전성 확보 조치)">
        <ul className="list-disc pl-5 space-y-1.5 text-text-secondary">
          <li><strong className="text-text-primary">접근 제어</strong>: Supabase Row Level Security(RLS)로 타 이용자 데이터 접근 불가</li>
          <li><strong className="text-text-primary">전송 보안</strong>: HTTPS(TLS) 암호화 통신</li>
          <li><strong className="text-text-primary">인증</strong>: JWT 기반 세션 관리, OAuth 2.0 소셜 로그인</li>
          <li><strong className="text-text-primary">최소 수집</strong>: 서비스 목적에 필요한 최소한의 정보만 수집</li>
        </ul>
      </Section>

      <Section title="제8조 (만 14세 미만 아동 보호)">
        <p className="text-text-secondary">마미스캔은 만 14세 미만 아동을 대상으로 하지 않으며, 해당 이용자의 가입이 확인될 경우 즉시 계정 및 관련 정보를 파기합니다.</p>
      </Section>

      <Section title="제9조 (개인정보 보호 책임자)">
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 space-y-1.5">
          <Row label="서비스명" value="마미스캔 (MamiScan)" />
          <Row label="책임자" value="허윤희 (대표)" />
          <Row label="문의" value="mamiscan2026@gmail.com" />
          <Row label="처리 기간" value="문의 접수 후 10일 이내" />
        </div>
        <p className="text-xs text-text-tertiary mt-3 leading-relaxed">
          개인정보 침해 신고: 개인정보보호위원회 (privacy.go.kr / 국번없이 182), 개인정보 분쟁조정위원회 (kopico.go.kr / 1833-6972)
        </p>
      </Section>

      <Section title="제10조 (개인정보처리방침 변경 공지)">
        <p className="text-text-secondary">중요한 내용이 변경될 경우 시행일로부터 최소 <strong className="text-text-primary">7일 전</strong>에 서비스 내 공지사항 또는 이메일을 통해 안내합니다. 공지 후 별도의 의사 표시가 없으면 변경에 동의한 것으로 간주합니다.</p>
      </Section>

      <div className="pt-2 pb-4 text-center text-xs text-text-tertiary">
        시행일: {PRIVACY_DATE}
      </div>
    </>
  );
}

/* ── 공통 내부 컴포넌트 ── */

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
  return <div className="overflow-x-auto rounded-xl border border-border-subtle">{children}</div>;
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
