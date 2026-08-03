import Image from "next/image";
import {
  ArrowDown,
  ArrowUpRight,
  BookOpen,
  Bot,
  Boxes,
  Brush,
  Camera,
  Check,
  CircleCheck,
  Film,
  Gamepad2,
  Headphones,
  Mail,
  Megaphone,
  MessageCircle,
  MonitorCog,
  Music2,
  Newspaper,
  PackageCheck,
  PanelsTopLeft,
  Palette,
  PenTool,
  Plus,
  Quote,
  SearchCheck,
  Share2,
  Smartphone,
  Sparkles,
  Type,
  Video,
} from "lucide-react";

const KAKAO_CHANNEL_URL = "https://pf.kakao.com/_dalbitmedia/chat";

const services = [
  { number: "01", title: "사이트 제작 및 관리", description: "브랜드의 가치가 선명하게 전달되는 사이트와 랜딩페이지를 만들고, 업데이트와 장애 대응까지 관리합니다.", icon: MonitorCog },
  { number: "02", title: "최종 테스트", description: "출시 전 사용 흐름과 콘텐츠를 꼼꼼히 확인하고, 발견된 이슈를 정리합니다.", icon: SearchCheck },
  { number: "03", title: "배포 및 업데이트", description: "채널별 배포 일정부터 월 1회 콘텐츠 업로드까지 안정적으로 운영합니다.", icon: PackageCheck },
  { number: "04", title: "마케팅 운영", description: "서비스에 맞는 메시지와 채널을 설계하고, 필요한 홍보 활동을 실행합니다.", icon: Megaphone },
  { number: "05", title: "리뷰 관리", description: "고객의 목소리를 놓치지 않도록 리뷰를 살피고 일관된 톤으로 답변합니다.", icon: MessageCircle },
  { number: "06", title: "고객 지원", description: "카카오채널과 이메일 문의를 분류하고, 빠르고 친절하게 응대합니다.", icon: Headphones },
];

const process = [
  ["01", "목표와 자료 파악", "브랜드, 고객, 보유 콘텐츠와 현재 운영 환경을 살펴봅니다."],
  ["02", "브랜드 기반 구축", "브랜드 사이트를 정리해 고객에게 보여줄 안정적인 기반을 만듭니다."],
  ["03", "출시와 배포", "최종 테스트를 거쳐 필요한 채널에 콘텐츠와 서비스를 배포합니다."],
  ["04", "성장과 고객관리", "마케팅, 리뷰와 문의를 운영하고 결과를 다음 실행에 반영합니다."],
];

const faqs = [
  ["어떤 서비스와 콘텐츠를 맡길 수 있나요?", "앱, 웹 서비스, 디지털 콘텐츠, 교육 및 구독 서비스 등 고객과 지속적으로 만나는 제품이라면 함께할 수 있습니다. 현재 운영 상황을 확인한 뒤 가장 적합한 범위를 제안합니다."],
  ["브랜드 사이트는 어디까지 제작하나요?", "기획, 화면 구성, 개발과 배포부터 콘텐츠 수정, 기능 업데이트, 오류 점검까지 지원합니다. 신규 제작과 기존 사이트 유지관리 중 필요한 범위를 선택할 수 있습니다."],
  ["월 49만원 기본 서비스에는 무엇이 포함되나요?", "카카오채널과 이메일 문의 응대, 리뷰 모니터링 및 답변, 월 1회 콘텐츠 업로드, 월간 운영 현황 정리가 포함됩니다."],
  ["필요한 업무만 선택할 수도 있나요?", "네. 기본 서비스를 중심으로 브랜드 사이트, 테스트, 배포, 추가 콘텐츠 제작, 소셜미디어 관리 중 필요한 업무만 선택해 구성할 수 있습니다."],
  ["고객 문의는 어떤 기준으로 답변하나요?", "서비스의 말투와 운영 정책을 먼저 정리한 뒤 승인된 응대 가이드에 따라 답변합니다. 중요한 이슈나 판단이 필요한 문의는 담당자에게 빠르게 공유합니다."],
  ["추가 콘텐츠 제작 비용은 어떻게 정해지나요?", "콘텐츠 종류, 분량, 제작 난이도에 따라 건별 10만원부터 책정됩니다. 요청 내용을 확인한 뒤 작업 전 정확한 비용과 일정을 안내합니다."],
  ["계약 전에 상담을 받을 수 있나요?", "물론입니다. 카카오채널로 현재 서비스와 고민을 알려주시면 필요한 운영 범위와 시작 방법을 편하게 상담해 드립니다."],
];

const supportedMedia = [
  ["앱", Smartphone],
  ["게임", Gamepad2],
  ["서비스", Boxes],
  ["웹사이트", MonitorCog],
  ["광고", Megaphone],
  ["사진", Camera],
  ["그림", Brush],
  ["예술품", Palette],
  ["뮤직비디오", Music2],
  ["숏폼", Video],
  ["영화", Film],
  ["문구", Type],
  ["소식", Newspaper],
  ["소설", BookOpen],
  ["웹툰", PanelsTopLeft],
] as const;

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="달빛미디어 홈">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span>달빛미디어</span>
        </a>
        <nav aria-label="주요 메뉴">
          <a href="#about">회사 소개</a>
          <a href="#services">서비스</a>
          <a href="#process">진행 방식</a>
          <a href="#pricing">이용 요금</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a className="header-contact" href={KAKAO_CHANNEL_URL} target="_blank" rel="noreferrer">
          <MessageCircle size={17} strokeWidth={2} /> 문의하기
        </a>
      </header>

      <section className="hero" id="top">
        <Image className="hero-image" src="/dalbit-team.jpg" alt="콘텐츠 운영 계획을 논의하는 팀" fill priority sizes="100vw" />
        <div className="hero-shade" />
        <div className="hero-content">
          <p className="eyebrow light"><Sparkles size={15} /> CREATIVE OPERATIONS PARTNER</p>
          <h1>달빛미디어</h1>
          <p className="hero-copy">당신은 더 좋은 것을 만드세요.<br />그다음의 모든 일은 우리가 맡겠습니다.</p>
          <div className="hero-actions">
            <a className="button button-coral" href={KAKAO_CHANNEL_URL} target="_blank" rel="noreferrer">카카오채널로 상담하기 <ArrowUpRight size={19} /></a>
            <a className="text-link light-link" href="#about">자세히 알아보기 <ArrowDown size={17} /></a>
          </div>
        </div>
        <div className="hero-index" aria-hidden="true"><span>BUILD</span><span>TEST</span><span>LAUNCH</span><span>GROW</span></div>
      </section>

      <div className="ticker" aria-hidden="true">
        <span>브랜드 사이트</span><i /><span>테스트</span><i /><span>배포</span><i /><span>마케팅</span><i /><span>리뷰 관리</span><i /><span>고객 지원</span>
      </div>

      <section className="about section" id="about">
        <div className="section-label"><span>01</span> ABOUT US</div>
        <div className="about-grid">
          <h2>창작의 마지막 단계부터<br />고객의 첫 반응까지.</h2>
          <div className="about-copy">
            <p className="lead">좋은 서비스와 콘텐츠가 운영 업무에 가려지지 않도록, 달빛미디어가 창작 바깥의 모든 일을 연결합니다.</p>
            <p>브랜드 사이트 제작부터 최종 테스트, 배포, 마케팅, 리뷰 관리, 고객 지원까지 하나의 팀처럼 수행합니다. 여러 업체와 따로 소통할 필요 없이, 창작자는 제품의 본질과 다음 아이디어에 집중할 수 있습니다.</p>
            <div className="promise"><CircleCheck size={22} /><span><strong>필요한 만큼, 한 팀처럼.</strong> 작은 출시부터 꾸준한 운영까지 함께합니다.</span></div>
          </div>
        </div>
      </section>

      <section className="services section" id="services">
        <div className="section-label"><span>02</span> WHAT WE DO</div>
        <div className="section-heading">
          <h2>만드는 일 외의<br />모든 것을 맡습니다.</h2>
          <p>브랜드의 첫인상을 만드는 일부터 출시와 고객관리까지 모든 접점을 세심하게 운영합니다.</p>
        </div>
        <div className="service-list">
          {services.map(({ number, title, description, icon: Icon }) => (
            <article className="service-row" key={title}>
              <span className="service-number">{number}</span>
              <span className="service-icon"><Icon size={24} strokeWidth={1.7} /></span>
              <h3>{title}</h3><p>{description}</p><ArrowUpRight className="service-arrow" size={22} />
            </article>
          ))}
        </div>
      </section>

      <section className="media-types section" id="media-types">
        <div className="section-label"><span>03</span> SUPPORTED MEDIA</div>
        <div className="media-heading">
          <h2>형식의 경계 없이,<br />좋은 콘텐츠라면.</h2>
          <p>디지털 서비스부터 한 편의 작품까지, 다양한 미디어의 출시와 성장을 지원합니다.</p>
        </div>
        <div className="media-grid">
          {supportedMedia.map(([label, Icon], index) => (
            <article className="media-card" key={label}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <Icon size={30} strokeWidth={1.6} aria-hidden="true" />
              <h3>{label}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="focus-band">
        <div className="focus-image-wrap"><Image src="/dalbit-team.jpg" alt="콘텐츠 운영에 집중하는 제작 팀" fill sizes="(max-width: 800px) 100vw, 50vw" /></div>
        <div className="focus-content"><Quote size={34} strokeWidth={1.4} /><blockquote>가장 잘하는 일에<br />더 오래 집중할 수 있도록.</blockquote><p>운영의 빈틈은 채우고, 창작의 가능성은 더 크게 만듭니다.</p></div>
      </section>

      <section className="process section" id="process">
        <div className="section-label"><span>04</span> HOW WE WORK</div>
        <div className="process-grid">
          <div className="process-intro"><h2>복잡한 운영을<br />단순한 흐름으로.</h2><p>현재 상황을 먼저 이해하고, 꼭 필요한 업무부터 시작합니다.</p></div>
          <ol className="process-list">
            {process.map(([number, title, description]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}
          </ol>
        </div>
      </section>

      <section className="pricing section" id="pricing">
        <div className="section-label"><span>05</span> PRICING</div>
        <div className="pricing-head">
          <div><p className="eyebrow"><Sparkles size={15} /> STARTER PLAN</p><h2>운영의 시작을<br />가볍고 든든하게.</h2></div>
          <div className="price"><span>월</span><strong>49</strong><em>만원부터</em></div>
        </div>
        <div className="automation-note">
          <Bot size={27} strokeWidth={1.7} />
          <div>
            <strong>에이전트 AI 자동화로 운영 비용을 낮췄습니다.</strong>
            <p>반복적인 모니터링, 문의 분류, 답변 초안 작업은 자동화하고 중요한 판단과 최종 고객 응대는 담당자가 직접 확인합니다.</p>
          </div>
        </div>
        <div className="pricing-body">
          <div className="included">
            <h3>기본 서비스에 포함됩니다</h3>
            <ul>
              <li><Check size={18} /> 카카오채널 고객 문의 응대</li><li><Check size={18} /> 이메일 고객 문의 응대</li>
              <li><Check size={18} /> 리뷰 모니터링 및 답변</li><li><Check size={18} /> 월 1회 콘텐츠 업로드</li>
              <li><Check size={18} /> 월간 운영 현황 정리</li>
            </ul>
          </div>
          <div className="options">
            <h3>필요한 서비스를 더하세요</h3>
            <div className="option-row"><MonitorCog size={22} /><div><strong>브랜드 사이트 제작 및 유지관리</strong><span>프로젝트별 별도 견적</span></div></div>
            <div className="option-row"><PenTool size={22} /><div><strong>추가 콘텐츠 제작 및 관리</strong><span>건별 10만원부터</span></div></div>
            <div className="option-row"><Share2 size={22} /><div><strong>소셜미디어 관리</strong><span>월 19만원부터</span></div></div>
            <p className="price-note">업무 범위와 채널 수에 따라 최종 견적이 달라질 수 있습니다.</p>
          </div>
        </div>
      </section>

      <section className="faq section" id="faq">
        <div className="section-label"><span>06</span> FREQUENTLY ASKED QUESTIONS</div>
        <div className="faq-grid">
          <div className="faq-intro">
            <h2>궁금한 점을<br />먼저 답해드려요.</h2>
            <p>그 밖의 궁금한 점은 카카오채널로 편하게 문의해 주세요.</p>
            <a className="text-link faq-link" href={KAKAO_CHANNEL_URL} target="_blank" rel="noreferrer">직접 문의하기 <ArrowUpRight size={17} /></a>
          </div>
          <div className="faq-list">
            {faqs.map(([question, answer], index) => (
              <details key={question} open={index === 0}>
                <summary><span>{question}</span><Plus size={21} aria-hidden="true" /></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="contact" id="contact">
        <div className="contact-moon" aria-hidden="true" />
        <div className="contact-content">
          <p className="eyebrow light"><MessageCircle size={15} /> LET&apos;S TALK</p>
          <h2>창작에 집중할 준비,<br />함께 시작해볼까요?</h2>
          <p>현재 운영 중인 서비스와 필요한 도움을 편하게 들려주세요.</p>
          <a className="button button-coral" href={KAKAO_CHANNEL_URL} target="_blank" rel="noreferrer">카카오채널 문의하기 <ArrowUpRight size={19} /></a>
        </div>
      </section>

      <footer>
        <div className="footer-brand"><span className="brand-mark">D</span><div><strong>달빛미디어</strong><span>창작자를 위한 운영 파트너</span></div></div>
        <div className="footer-contact"><a href="mailto:hello@dalbitmedia.com"><Mail size={16} /> hello@dalbitmedia.com</a><a href={KAKAO_CHANNEL_URL} target="_blank" rel="noreferrer"><MessageCircle size={16} /> 카카오채널</a></div>
        <p>© 2026 DALBIT MEDIA. ALL RIGHTS RESERVED.</p>
      </footer>
    </main>
  );
}
