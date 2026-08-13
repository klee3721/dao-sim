import { analyzeName, type NameAnalysis } from "./name-number";

export type EnergyId =
  | "PV"
  | "TY"
  | "SK"
  | "DN"
  | "LS"
  | "TM"
  | "HH"
  | "NQ";

export type AnalysisMode = "number" | "phone" | "cccd" | "name";
export type Polarity = "cat" | "hung";
export type StrengthLevel = 1 | 2 | 3 | 4;

export interface EnergyInfo {
  id: EnergyId;
  name: string;
  label: string;
  polarity: Polarity;
  shortSummary: string;
  keywords: string[];
  overview: string;
  strengths: string[];
  limitations: string[];
  career: string[];
  finance: string[];
  relationships: string[];
  health: string[];
  advice: string[];
}

export interface PairRule {
  pair: string;
  energyId: EnergyId;
  strength: StrengthLevel;
}

export interface AnalyzedPair {
  id: string;
  pair: string;
  segment: string;
  start: number;
  end: number;
  energyId?: EnergyId;
  strength?: StrengthLevel;
  source: "standard" | "zero-bridge" | "cccd-zero" | "five-special";
  hiddenByZero?: boolean;
  triggeredByFive?: boolean;
  note?: string;
}

export interface EnergyTransition {
  id: string;
  from: EnergyId;
  to: EnergyId;
  fromPair: string;
  toPair: string;
  fromStrength?: StrengthLevel;
  toStrength?: StrengthLevel;
}

export interface FortuneCycle {
  age: string;
  pair: string;
  energyId?: EnergyId;
  strength?: StrengthLevel;
  special?: boolean;
}

export interface AnalysisResult {
  mode: AnalysisMode;
  normalizedInput: string;
  analyzedDigits: string;
  nameAnalysis?: NameAnalysis;
  pairs: AnalyzedPair[];
  transitions: EnergyTransition[];
  counts: Record<EnergyId, number>;
  dominantEnergies: EnergyId[];
  endingEnergy?: EnergyId;
  endingStrength?: StrengthLevel;
  catCount: number;
  hungCount: number;
  strongClusters: AnalyzedPair[][];
  specialWarnings: string[];
  quickCodeMatches: QuickCode[];
  tailDigits?: string;
  fortuneCycles?: FortuneCycle[];
}

export interface QuickCode {
  code: string;
  category: "career" | "relationship";
  label: string;
}

export interface NormalizeResult {
  digits: string;
  error?: string;
}

export interface HungConversionGuidance {
  energyId: EnergyId;
  targetLabel: string;
  summary: string;
}

export const ENERGY_ORDER: EnergyId[] = [
  "TY",
  "SK",
  "DN",
  "PV",
  "LS",
  "HH",
  "NQ",
  "TM",
];

export const ENERGIES: Record<EnergyId, EnergyInfo> = {
  PV: {
    id: "PV",
    name: "Phục Vị",
    label: "Tiềm lực & ổn định",
    polarity: "cat",
    shortSummary:
      "Năng lượng tĩnh, bền bỉ và tiềm ẩn. Đi cùng trường tốt sẽ nâng đỡ, đi cùng trường bất lợi có thể làm tính chất ấy kéo dài.",
    keywords: ["Kiên trì", "Tiềm lực", "Ổn định", "Lặp lại"],
    overview:
      "Phục Vị đại diện cho sức mạnh nằm sâu bên trong, khả năng chịu đựng và xu hướng giữ nguyên hiện trạng. Người mang năng lượng này thường bền bỉ, kín đáo, có lập trường nhưng cần tránh trì trệ và thiếu quyết đoán.",
    strengths: [
      "Có nghị lực, chịu khó và sức bền.",
      "Kiên trì với công việc cần chiều sâu.",
      "Lập trường tương đối vững vàng.",
      "Phù hợp môi trường ổn định, có quy trình.",
    ],
    limitations: [
      "Dễ an phận, chậm thay đổi.",
      "Có thể bỏ lỡ cơ hội vì thiếu quyết đoán.",
      "Khi đi cùng hung tinh, mặt hạn chế dễ bị kéo dài.",
    ],
    career: [
      "Phù hợp công việc ổn định, nghiên cứu, kỹ thuật hoặc cần sự kiên nhẫn.",
      "Cần chủ động hơn khi cơ hội xuất hiện.",
    ],
    finance: [
      "Thiên về giữ hiện trạng, ngại mạo hiểm.",
      "Tài chính tăng chậm nhưng có thể bền nếu có kỷ luật.",
    ],
    relationships: [
      "Tình cảm kín đáo, khó chủ động bộc lộ.",
      "Cần giao tiếp rõ ràng để tránh nghi ngờ và xa cách.",
    ],
    health: [
      "Tài liệu lưu ý đến tim, não và tình trạng lo nghĩ kéo dài.",
      "Nên duy trì vận động và nhịp nghỉ ngơi đều đặn.",
    ],
    advice: [
      "Giữ sự bền bỉ nhưng đặt thời hạn cho quyết định.",
      "Chủ động thử nghiệm thay đổi nhỏ.",
      "Không để sự ổn định biến thành trì trệ.",
    ],
  },
  TY: {
    id: "TY",
    name: "Thiên Y",
    label: "Tình, tiền & phúc khí",
    polarity: "cat",
    shortSummary:
      "Từ trường của tình, tiền, lòng thiện và phúc khí. Có duyên với cơ hội tài chính, tình cảm và sự nâng đỡ.",
    keywords: ["Tình", "Tiền", "Phúc khí", "Chữa lành"],
    overview:
      "Thiên Y thiên về lòng thiện, sự thông minh, tình cảm đoan chính và khả năng thu hút nguồn lực. Mặt trái là dễ cả tin, cho đi quá nhiều hoặc thiếu ranh giới.",
    strengths: [
      "Thông minh, thiện lương và rộng rãi.",
      "Có duyên với tài lộc và cơ hội.",
      "Dễ gặp người lớn tuổi hoặc quý nhân hỗ trợ.",
      "Có khả năng chữa lành và tạo cảm giác tin cậy.",
    ],
    limitations: [
      "Dễ cả tin hoặc bị lợi dụng.",
      "Có thể quá phóng khoáng với tiền.",
      "Dễ đặt nhu cầu của người khác lên trước bản thân.",
    ],
    career: [
      "Có tố chất làm chủ hoặc phát triển công việc có giá trị cho cộng đồng.",
      "Phù hợp lĩnh vực cần uy tín, sự tử tế và quan hệ bền vững.",
    ],
    finance: [
      "Có duyên kiếm tiền và nhìn thấy cơ hội.",
      "Cần quản trị dòng tiền, tránh cho đi hoặc đầu tư theo cảm xúc.",
    ],
    relationships: [
      "Thiên về tình cảm chân thành, lãng mạn và mong muốn gắn bó.",
      "Cần giữ ranh giới để lòng tốt không trở thành gánh nặng.",
    ],
    health: [
      "Tài liệu lưu ý tuần hoàn máu, huyết áp, tim mạch và giác quan.",
      "Nên chú ý nhịp sống cân bằng khi năng lượng Thiên Y tụ tập.",
    ],
    advice: [
      "Cho đi đúng người, đúng việc và đúng thời điểm.",
      "Giữ lòng thiện nhưng cần nguyên tắc.",
      "Tận dụng cơ hội đi cùng kế hoạch tài chính rõ ràng.",
    ],
  },
  SK: {
    id: "SK",
    name: "Sinh Khí",
    label: "Quý nhân & cơ hội",
    polarity: "cat",
    shortSummary:
      "Năng lượng của sự vui vẻ, phát triển, cơ hội và quý nhân. Mang đến khả năng mở lối và gặp dữ hóa lành.",
    keywords: ["Quý nhân", "Cơ hội", "Lạc quan", "Phát triển"],
    overview:
      "Sinh Khí đại diện cho sức sống, niềm vui và khả năng kết nối. Người mang năng lượng này thường thoáng tính, dễ gặp may và được giúp đỡ, nhưng có thể an phận hoặc tiêu tiền vì bạn bè.",
    strengths: [
      "Lạc quan, thân thiện và kết nối tốt.",
      "Dễ gặp quý nhân và cơ hội bất ngờ.",
      "Có khả năng làm mới môi trường.",
      "Thường giữ được tinh thần tích cực.",
    ],
    limitations: [
      "Có thể lười thay đổi khi đang thoải mái.",
      "Dễ tin người hoặc xem nhẹ rủi ro.",
      "Khó giữ tiền nếu quá hào phóng.",
    ],
    career: [
      "Phù hợp công việc mở rộng quan hệ, cộng đồng hoặc cần năng lượng tích cực.",
      "Thành công thường đến qua kết nối và cơ hội.",
    ],
    finance: [
      "Dòng tiền có thể đến bất ngờ hoặc qua quý nhân.",
      "Cần kỷ luật để giữ lại thành quả.",
    ],
    relationships: [
      "Cởi mở, không quá so đo và dễ tạo bầu không khí vui vẻ.",
      "Cần phân biệt bạn bè tốt với mối quan hệ tiêu hao.",
    ],
    health: [
      "Tài liệu lưu ý dạ dày và xu hướng chủ quan với tín hiệu sức khỏe.",
      "Nên duy trì lịch kiểm tra và nghỉ ngơi đều.",
    ],
    advice: [
      "Biến cơ hội thành kế hoạch cụ thể.",
      "Giữ sự vui vẻ nhưng không chủ quan.",
      "Chọn mối quan hệ có giá trị lâu dài.",
    ],
  },
  DN: {
    id: "DN",
    name: "Diên Niên",
    label: "Năng lực & sự nghiệp",
    polarity: "cat",
    shortSummary:
      "Từ trường của năng lực, trách nhiệm, uy tín và sự nghiệp bền vững. Mạnh về tổ chức, gánh vác và tích lũy.",
    keywords: ["Sự nghiệp", "Trách nhiệm", "Uy tín", "Bền vững"],
    overview:
      "Diên Niên đại diện cho năng lực chuyên môn, khả năng lãnh đạo và tinh thần trách nhiệm. Mặt hạn chế là dễ cứng nhắc, ôm việc, bảo thủ hoặc tự tạo áp lực.",
    strengths: [
      "Có trách nhiệm, uy tín và khả năng chịu áp lực.",
      "Kiên trì, cẩn thận và có nguyên tắc.",
      "Có tố chất lãnh đạo và tổ chức.",
      "Biết tích lũy và xây nền tảng lâu dài.",
    ],
    limitations: [
      "Dễ bảo thủ, gia trưởng hoặc cường thế.",
      "Hay gánh việc và khó nhờ người khác.",
      "Có thể đặt công việc cao hơn đời sống riêng.",
    ],
    career: [
      "Phù hợp lãnh đạo, quản lý, chuyên môn và công việc cần trách nhiệm.",
      "Thành tựu đến từ năng lực và sự bền bỉ hơn là may mắn.",
    ],
    finance: [
      "Có khả năng giữ tiền và tích lũy.",
      "Tài chính thường tăng theo năng lực và thời gian.",
    ],
    relationships: [
      "Trung thành và có trách nhiệm với gia đình.",
      "Cần mềm mỏng, chia sẻ cảm xúc và tránh kiểm soát.",
    ],
    health: [
      "Tài liệu lưu ý cổ vai gáy, xương khớp, mất ngủ và áp lực.",
      "Nên phân chia trách nhiệm và nghỉ ngơi đúng lúc.",
    ],
    advice: [
      "Giữ chữ tín nhưng không ôm tất cả trách nhiệm.",
      "Lắng nghe ý kiến khác biệt.",
      "Xây hệ thống thay vì chỉ dựa vào sức cá nhân.",
    ],
  },
  LS: {
    id: "LS",
    name: "Lục Sát",
    label: "Cảm xúc & quan hệ",
    polarity: "hung",
    shortSummary:
      "Từ trường của cảm xúc, sự tinh tế, sức hút và các mối quan hệ. Bài học lớn nằm ở quản trị cảm xúc và kết nối.",
    keywords: ["Cảm xúc", "Tinh tế", "Quan hệ", "Đào hoa"],
    overview:
      "Lục Sát có sự nhạy cảm, khéo léo và sức hút trong giao tiếp. Khi mất cân bằng, năng lượng này dễ dẫn đến suy diễn, tổn thương, mâu thuẫn hoặc các quan hệ phức tạp.",
    strengths: [
      "Tinh tế, khéo léo và có gu thẩm mỹ.",
      "Nhạy cảm với tâm lý người khác.",
      "Có khả năng giao tiếp và xây dựng quan hệ.",
      "Phù hợp lĩnh vực dịch vụ, tư vấn và làm đẹp.",
    ],
    limitations: [
      "Dễ suy nghĩ nhiều, đa nghi và dao động.",
      "Có thể để cảm xúc dẫn dắt quyết định.",
      "Dễ vướng hiểu lầm hoặc quan hệ phức tạp.",
    ],
    career: [
      "Có lợi thế trong công việc cần sự tinh tế và quan hệ.",
      "Cần tách cảm xúc khỏi quyết định chuyên môn.",
    ],
    finance: [
      "Tiền có thể đến qua quan hệ nhưng cũng dễ tiêu theo cảm xúc.",
      "Cần nguyên tắc rõ khi hợp tác hoặc cho vay.",
    ],
    relationships: [
      "Giàu cảm xúc và dễ tạo sức hút.",
      "Cần ranh giới, sự rõ ràng và khả năng lắng nghe.",
    ],
    health: [
      "Tài liệu lưu ý dạ dày, da, giấc ngủ và trạng thái u buồn.",
      "Nên chăm sóc sức khỏe tinh thần và duy trì môi trường tích cực.",
    ],
    advice: [
      "Không quyết định khi đang tổn thương hoặc nóng giận.",
      "Lắng nghe nhiều hơn, phán xét ít hơn.",
      "Biến sự nhạy cảm thành khả năng thấu cảm.",
    ],
  },
  HH: {
    id: "HH",
    name: "Họa Hại",
    label: "Lời nói & thử thách",
    polarity: "hung",
    shortSummary:
      "Năng lượng của lời nói, thị phi, hiểu lầm và những trở ngại nhỏ tích tụ. Mặt tích cực là khả năng biểu đạt và nhìn nhận đa chiều.",
    keywords: ["Lời nói", "Thị phi", "Hiểu lầm", "Thử thách"],
    overview:
      "Họa Hại thường biểu hiện qua giao tiếp, sĩ diện, nóng vội hoặc các rắc rối phát sinh từ chi tiết nhỏ. Khi chuyển hóa tốt, đây là năng lực nói đúng, thuyết phục và xử lý mâu thuẫn.",
    strengths: [
      "Hoạt ngôn, phản ứng nhanh và có sức thuyết phục.",
      "Có khả năng nhìn vấn đề đa chiều.",
      "Có thể trở thành người giao tiếp khéo léo.",
    ],
    limitations: [
      "Dễ phát sinh tranh cãi hoặc hiểu lầm.",
      "Nóng tính, thẳng lời và dễ bị tác động bởi đánh giá.",
      "Có thể xem nhẹ chi tiết nhỏ.",
    ],
    career: [
      "Có lợi thế trong đào tạo, tư vấn, thuyết trình và bán hàng.",
      "Cần minh bạch trong giấy tờ, cam kết và phối hợp.",
    ],
    finance: [
      "Có khả năng kiếm tiền bằng lời nói hoặc giao tiếp.",
      "Cần tránh quyết định vội, chi tiêu sĩ diện và bỏ qua chi tiết.",
    ],
    relationships: [
      "Ban đầu dễ tạo thiện cảm nhưng có thể khắc khẩu.",
      "Cần nói chậm, nghe kỹ và tránh tranh luận hơn thua.",
    ],
    health: [
      "Tài liệu lưu ý hô hấp, cổ họng, xoang và tình trạng mệt mỏi.",
      "Nên chăm sóc giấc ngủ và giảm căng thẳng giao tiếp.",
    ],
    advice: [
      "Tu khẩu: nói đúng lúc, đúng người và đúng mục đích.",
      "Kiểm tra chi tiết trước quyết định lớn.",
      "Biến thị phi thành kinh nghiệm và uy tín.",
    ],
  },
  NQ: {
    id: "NQ",
    name: "Ngũ Quỷ",
    label: "Tư duy & biến động",
    polarity: "hung",
    shortSummary:
      "Từ trường của trí tuệ, sáng tạo, biến động và nhiều ý tưởng. Bài học nằm ở sự tập trung, ổn định và kỷ luật.",
    keywords: ["Sáng tạo", "Biến động", "Trí tuệ", "Bất ổn"],
    overview:
      "Ngũ Quỷ thường nhanh nhạy, đa tài, học nhanh và thích thay đổi. Khi mất cân bằng, người mang năng lượng này dễ phân tán, bất an, đổi hướng hoặc theo đuổi cơ hội thiếu ổn định.",
    strengths: [
      "Thông minh, học nhanh và phản ứng tốt.",
      "Nhiều ý tưởng, sáng tạo và khả năng thích nghi.",
      "Phù hợp công nghệ, nghiên cứu, thiết kế và công việc biến đổi.",
    ],
    limitations: [
      "Dễ thay đổi thất thường và thiếu tập trung.",
      "Hay suy nghĩ nhiều hoặc tự tạo áp lực.",
      "Có thể tìm đường tắt và chấp nhận rủi ro cao.",
    ],
    career: [
      "Phù hợp môi trường sáng tạo, kỹ thuật hoặc cần xử lý vấn đề nhanh.",
      "Cần chọn một hướng đủ lâu để tạo thành tựu.",
    ],
    finance: [
      "Có khả năng nhìn thấy nhiều cơ hội.",
      "Cần tránh đầu tư dàn trải hoặc làm giàu quá nhanh.",
    ],
    relationships: [
      "Tâm tính biến đổi khiến người khác khó nắm bắt.",
      "Cần giao tiếp nhất quán và giữ cam kết.",
    ],
    health: [
      "Tài liệu lưu ý giấc ngủ, tim mạch và áp lực tinh thần.",
      "Nên giảm nhiễu thông tin, nghỉ ngơi và giữ lịch sinh hoạt.",
    ],
    advice: [
      "Chọn ít mục tiêu hơn và hoàn thành đến cùng.",
      "Giữ kỷ luật khi cảm hứng thay đổi.",
      "Biến ý tưởng thành kế hoạch có mốc kiểm chứng.",
    ],
  },
  TM: {
    id: "TM",
    name: "Tuyệt Mệnh",
    label: "Quyết liệt & được mất",
    polarity: "hung",
    shortSummary:
      "Từ trường của sự quyết liệt, đầu tư, thay đổi lớn và trạng thái được–mất rõ rệt. Có sức bật mạnh nhưng cần quản trị rủi ro.",
    keywords: ["Quyết liệt", "Đầu tư", "Biến đổi", "Được–mất"],
    overview:
      "Tuyệt Mệnh có ý chí, tốc độ hành động và khả năng vượt nghịch cảnh. Mặt hạn chế là cực đoan, nóng vội, dễ tất tay hoặc tạo ra những đứt gãy lớn khi thiếu kiểm soát.",
    strengths: [
      "Dám nghĩ, dám làm và chịu trách nhiệm.",
      "Có tố chất làm chủ, đầu tư và xây hệ thống.",
      "Khả năng đứng dậy sau khó khăn.",
      "Hành động nhanh và có tham vọng.",
    ],
    limitations: [
      "Dễ cực đoan, nóng vội hoặc liều lĩnh.",
      "Có xu hướng được nhanh, mất nhanh.",
      "Khó dừng lại khi đã quyết định.",
    ],
    career: [
      "Phù hợp đầu tư, tài chính, kinh doanh và môi trường cần quyết đoán.",
      "Cần hệ thống kiểm soát và người phản biện đáng tin.",
    ],
    finance: [
      "Có khả năng tạo kết quả lớn nhưng rủi ro cũng lớn.",
      "Không nên tất tay hoặc quyết định chỉ theo cảm xúc.",
    ],
    relationships: [
      "Trọng tình nghĩa nhưng phản ứng mạnh khi bị tổn thương.",
      "Cần học cách buông bỏ và giữ đường lui trong giao tiếp.",
    ],
    health: [
      "Tài liệu cảnh báo về tai nạn, gan thận và các rủi ro do hành động quá mức.",
      "Nên đặt an toàn và kiểm tra chuyên môn lên trước cảm giác chủ quan.",
    ],
    advice: [
      "Dùng sự quyết liệt đi cùng kỷ luật quản trị rủi ro.",
      "Dừng đúng lúc quan trọng hơn tiến thật nhanh.",
      "Biến mỗi lần đứt gãy thành một lần tái cấu trúc.",
    ],
  },
};

export const HUNG_CONVERSION_GUIDANCE: Partial<
  Record<EnergyId, HungConversionGuidance>
> = {
  HH: {
    energyId: "HH",
    targetLabel: "Sinh Khí",
    summary:
      "Ưu tiên bổ sung năng lượng Sinh Khí để hỗ trợ chuyển hóa Họa Hại.",
  },
  LS: {
    energyId: "LS",
    targetLabel: "Diên Niên",
    summary:
      "Ưu tiên bổ sung năng lượng Diên Niên để hỗ trợ chuyển hóa Lục Sát.",
  },
  TM: {
    energyId: "TM",
    targetLabel: "Thiên Y",
    summary:
      "Ưu tiên bổ sung năng lượng Thiên Y để hỗ trợ chuyển hóa Tuyệt Mệnh.",
  },
  NQ: {
    energyId: "NQ",
    targetLabel: "Sinh Khí → Thiên Y → Diên Niên",
    summary:
      "Dùng tổ hợp Sinh Khí → Thiên Y → Diên Niên và giữ đúng thứ tự theo tài liệu chính.",
  },
};

const PAIR_LEVELS: Record<EnergyId, string[][]> = {
  TY: [
    ["13", "31"],
    ["68", "86"],
    ["49", "94"],
    ["27", "72"],
  ],
  SK: [
    ["14", "41"],
    ["76", "67"],
    ["39", "93"],
    ["28", "82"],
  ],
  DN: [
    ["19", "91"],
    ["87", "78"],
    ["43", "34"],
    ["26", "62"],
  ],
  LS: [
    ["16", "61"],
    ["47", "74"],
    ["38", "83"],
    ["29", "92"],
  ],
  TM: [
    ["12", "21"],
    ["96", "69"],
    ["84", "48"],
    ["37", "73"],
  ],
  HH: [
    ["17", "71"],
    ["98", "89"],
    ["46", "64"],
    ["23", "32"],
  ],
  NQ: [
    ["18", "81"],
    ["97", "79"],
    ["36", "63"],
    ["24", "42"],
  ],
  PV: [
    ["11", "22"],
    ["88", "99"],
    ["77", "66"],
    ["33", "44"],
  ],
};

export const PAIR_RULES: Record<string, PairRule> = Object.fromEntries(
  Object.entries(PAIR_LEVELS).flatMap(([energyId, levels]) =>
    levels.flatMap((pairs, levelIndex) =>
      pairs.map((pair) => [
        pair,
        {
          pair,
          energyId: energyId as EnergyId,
          strength: (levelIndex + 1) as StrengthLevel,
        },
      ]),
    ),
  ),
);

export const QUICK_CODES: QuickCode[] = [
  ...["218", "697", "481", "8161", "7929", "6383", "2171", "6989", "7181", "8979", "81616"].map(
    (code) => ({
      code,
      category: "career" as const,
      label: "Cấu trúc được tài liệu lưu ý về biến động công việc",
    }),
  ),
  ...["1666", "6111", "161", "474", "383", "838", "618", "297", "479", "617", "471", "2118", "6997", "6977", "318", "681", "497"].map(
    (code) => ({
      code,
      category: "relationship" as const,
      label: "Cấu trúc được tài liệu lưu ý về dao động tình cảm",
    }),
  ),
];

const EMPTY_COUNTS: Record<EnergyId, number> = {
  PV: 0,
  TY: 0,
  SK: 0,
  DN: 0,
  LS: 0,
  TM: 0,
  HH: 0,
  NQ: 0,
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function normalizeInput(
  rawInput: string,
  mode: AnalysisMode,
): NormalizeResult {
  if (mode === "name") {
    return { digits: rawInput.normalize("NFC").trim().replace(/\s+/gu, " ") };
  }

  let compact = rawInput.trim().replace(/[\s.\-()]/g, "");

  if (mode === "phone" && compact.startsWith("+84")) {
    compact = `0${compact.slice(3)}`;
  }

  if (compact.length === 0) {
    return { digits: "" };
  }

  if (!/^\d+$/.test(compact)) {
    return {
      digits: compact.replace(/\D/g, ""),
      error: "Vui lòng chỉ nhập chữ số và các ký tự định dạng thông dụng.",
    };
  }

  if (mode === "number" && compact.length > 30) {
    return {
      digits: compact,
      error: "Chế độ Số hỗ trợ tối đa 30 chữ số trong một lần xem.",
    };
  }

  if (mode === "phone" && compact.length !== 10) {
    return {
      digits: compact,
      error: `Số điện thoại cần đủ 10 chữ số. Hiện có ${compact.length} chữ số.`,
    };
  }

  if (mode === "phone" && !compact.startsWith("0")) {
    return {
      digits: compact,
      error: "Số điện thoại Việt Nam cần bắt đầu bằng 0 hoặc +84.",
    };
  }

  if (mode === "cccd" && compact.length !== 12) {
    return {
      digits: compact,
      error: `CCCD cần đủ 12 chữ số. Hiện có ${compact.length} chữ số.`,
    };
  }

  return { digits: compact };
}

function standardPair(
  pair: string,
  segment: string,
  start: number,
  end: number,
): AnalyzedPair | undefined {
  const rule = PAIR_RULES[pair];
  if (!rule) return undefined;
  return {
    id: `${start}-${end}-${pair}`,
    pair,
    segment,
    start,
    end,
    energyId: rule.energyId,
    strength: rule.strength,
    source: "standard",
  };
}

function analyzeGenericDigits(digits: string): {
  pairs: AnalyzedPair[];
  warnings: string[];
} {
  const pairs: AnalyzedPair[] = [];
  const warnings: string[] = [];

  for (let index = 0; index < digits.length - 1; index += 1) {
    const pair = digits.slice(index, index + 2);
    const item = standardPair(pair, pair, index, index + 1);

    if (item) {
      pairs.push(item);
      continue;
    }

    if (pair.includes("5")) {
      pairs.push({
        id: `${index}-${index + 1}-${pair}`,
        pair,
        segment: pair,
        start: index,
        end: index + 1,
        source: "five-special",
        note: "Cặp đặc biệt có số 5, không tự thuộc một trong tám từ trường.",
      });
    }
  }

  for (let index = 0; index < digits.length; index += 1) {
    if (digits[index] !== "0") continue;

    const previous = digits[index - 1];
    const next = digits[index + 1];
    const canBridge =
      previous &&
      next &&
      previous !== "0" &&
      next !== "0" &&
      previous !== "5" &&
      next !== "5";

    if (canBridge) {
      const basePair = `${previous}${next}`;
      const rule = PAIR_RULES[basePair];
      if (rule) {
        pairs.push({
          id: `${index - 1}-${index + 1}-${basePair}-zero`,
          pair: basePair,
          segment: `${previous}0${next}`,
          start: index - 1,
          end: index + 1,
          energyId: rule.energyId,
          strength: rule.strength,
          source: "zero-bridge",
          hiddenByZero: true,
          note: "Số 0 tạo hiệu ứng ẩn tàng cho cặp nền.",
        });
      }
    }

    if (!canBridge) {
      warnings.push(
        "Có số 0 không đủ điều kiện tạo cặp nền; hệ thống chỉ ghi nhận cảnh báo ẩn tàng.",
      );
    }
  }

  if (digits.endsWith("0")) {
    warnings.push(
      "Dãy kết thúc bằng số 0 — tài liệu chính xem đây là trường hợp cần đặc biệt lưu ý.",
    );
  }

  const triggeredIds = new Set<string>();
  for (let index = 0; index < digits.length; index += 1) {
    if (digits[index] !== "5") continue;
    const adjacent = pairs.filter(
      (item) =>
        item.energyId &&
        (item.end === index - 1 || item.start === index + 1),
    );

    if (adjacent.length === 0) {
      warnings.push(
        "Có số 5 nhưng không đứng sát một cặp chuẩn; không tự gán từ trường.",
      );
    } else {
      adjacent.forEach((item) => triggeredIds.add(item.id));
    }
  }

  const enriched = pairs
    .map((item) =>
      triggeredIds.has(item.id)
        ? {
            ...item,
            triggeredByFive: true,
            note: item.note
              ? `${item.note} Số 5 kích phát năng lượng này.`
              : "Số 5 kích phát năng lượng của cặp.",
          }
        : item,
    )
    .sort((left, right) => left.start - right.start || left.end - right.end);

  return { pairs: enriched, warnings: unique(warnings) };
}

function analyzeCccdDigits(digits: string): {
  pairs: AnalyzedPair[];
  warnings: string[];
} {
  const pairs: AnalyzedPair[] = [];
  const warnings: string[] = [];

  for (let index = 0; index < digits.length - 1; index += 1) {
    const pair = digits.slice(index, index + 2);
    const item = standardPair(pair, pair, index, index + 1);
    if (item) {
      pairs.push(item);
      continue;
    }

    if (pair.includes("0")) {
      pairs.push({
        id: `${index}-${index + 1}-${pair}-cccd-zero`,
        pair,
        segment: pair,
        start: index,
        end: index + 1,
        energyId: "PV",
        source: "cccd-zero",
        hiddenByZero: true,
        note: "Phục Vị đặc biệt có số 0 trong ngữ cảnh CCCD.",
      });
      continue;
    }

    if (pair.includes("5")) {
      pairs.push({
        id: `${index}-${index + 1}-${pair}-five`,
        pair,
        segment: pair,
        start: index,
        end: index + 1,
        source: "five-special",
        note: "Cặp có số 5, không tự gán từ trường.",
      });
    }
  }

  if (/000/.test(digits)) {
    warnings.push(
      "CCCD có nhiều số 0 liên tiếp; tài liệu chính xem đây là dấu hiệu năng lượng tiên thiên yếu.",
    );
  }

  return { pairs, warnings };
}

function buildTransitions(pairs: AnalyzedPair[]): EnergyTransition[] {
  const classified = pairs.filter(
    (pair): pair is AnalyzedPair & { energyId: EnergyId } =>
      Boolean(pair.energyId),
  );
  const transitions: EnergyTransition[] = [];

  for (let index = 0; index < classified.length - 1; index += 1) {
    const current = classified[index];
    const next = classified[index + 1];
    transitions.push({
      id: `${current.id}-${next.id}`,
      from: current.energyId,
      to: next.energyId,
      fromPair: current.pair,
      toPair: next.pair,
      fromStrength: current.strength,
      toStrength: next.strength,
    });
  }

  return transitions;
}

function countEnergies(pairs: AnalyzedPair[]): Record<EnergyId, number> {
  const counts = { ...EMPTY_COUNTS };
  pairs.forEach((pair) => {
    if (pair.energyId) counts[pair.energyId] += 1;
  });
  return counts;
}

function findDominants(counts: Record<EnergyId, number>): EnergyId[] {
  const maximum = Math.max(...Object.values(counts));
  if (maximum === 0) return [];
  return (Object.entries(counts) as Array<[EnergyId, number]>)
    .filter(([, value]) => value === maximum)
    .map(([energyId]) => energyId);
}

function findStrongClusters(pairs: AnalyzedPair[]): AnalyzedPair[][] {
  const clusters: AnalyzedPair[][] = [];
  let current: AnalyzedPair[] = [];

  pairs.forEach((pair) => {
    const isStrongHung =
      pair.energyId &&
      ENERGIES[pair.energyId].polarity === "hung" &&
      pair.strength !== undefined &&
      pair.strength <= 2;

    if (isStrongHung) {
      current.push(pair);
    } else {
      if (current.length >= 2) clusters.push(current);
      current = [];
    }
  });

  if (current.length >= 2) clusters.push(current);
  return clusters;
}

function classifyFortunePair(pair: string): {
  energyId?: EnergyId;
  strength?: StrengthLevel;
  special?: boolean;
} {
  const standard = PAIR_RULES[pair];
  if (standard) {
    return {
      energyId: standard.energyId,
      strength: standard.strength,
    };
  }
  if (pair.includes("0")) return { energyId: "PV", special: true };
  return {};
}

function buildFortuneCycles(fullCccd: string): FortuneCycle[] {
  const adjacentPairs = Array.from(
    { length: fullCccd.length - 1 },
    (_, index) => fullCccd.slice(index, index + 2),
  );

  const ageLabels = [
    "1–10",
    "10–15",
    "15–20",
    "20–25",
    "25–30",
    "30–35",
    "35–40",
    "40–45",
    "45–50",
    "50–55",
    "55–70",
  ];

  const cycles = adjacentPairs.map((pair, index) => ({
    age: ageLabels[index] ?? `${50 + index * 5}–${55 + index * 5}`,
    pair,
    ...classifyFortunePair(pair),
  }));

  const wrapPair = `${fullCccd.at(-1)}${fullCccd[0]}`;
  cycles.push({
    age: "70–75",
    pair: wrapPair,
    ...classifyFortunePair(wrapPair),
  });

  adjacentPairs.slice(0, 3).forEach((pair, index) => {
    cycles.push({
      age: `${75 + index * 5}–${80 + index * 5}`,
      pair,
      ...classifyFortunePair(pair),
    });
  });

  return cycles;
}

export function analyze(
  rawInput: string,
  mode: AnalysisMode,
): { result?: AnalysisResult; error?: string; normalized: string } {
  const normalized = normalizeInput(rawInput, mode);
  if (normalized.error) {
    return { error: normalized.error, normalized: normalized.digits };
  }

  if (mode === "name") {
    if (!normalized.digits) {
      return {
        error: "Hãy nhập tên bạn muốn luận giải.",
        normalized: normalized.digits,
      };
    }

    const nameAnalysis = analyzeName(normalized.digits);
    if (nameAnalysis.letters.length === 0) {
      return {
        error: "Tên chưa có chữ cái nào thuộc bảng quy đổi.",
        normalized: normalized.digits,
      };
    }

    const analyzedDigits = nameAnalysis.filteredSequence;
    const sequence =
      analyzedDigits.length >= 2
        ? analyzeGenericDigits(analyzedDigits)
        : {
            pairs: [],
            warnings: [
              "Tổ hợp tên sau khi bỏ 0 và 5 chưa đủ 2 chữ số để tạo cặp năng lượng.",
            ],
          };
    const counts = countEnergies(sequence.pairs);
    const classified = sequence.pairs.filter((pair) => pair.energyId);
    const endingPair = classified.at(-1);
    const catCount = classified.filter(
      (pair) => pair.energyId && ENERGIES[pair.energyId].polarity === "cat",
    ).length;
    const hungCount = classified.filter(
      (pair) => pair.energyId && ENERGIES[pair.energyId].polarity === "hung",
    ).length;

    return {
      result: {
        mode,
        normalizedInput: normalized.digits,
        analyzedDigits,
        nameAnalysis,
        pairs: sequence.pairs,
        transitions: buildTransitions(sequence.pairs),
        counts,
        dominantEnergies: findDominants(counts),
        endingEnergy: endingPair?.energyId,
        endingStrength: endingPair?.strength,
        catCount,
        hungCount,
        strongClusters: findStrongClusters(sequence.pairs),
        specialWarnings: sequence.warnings,
        quickCodeMatches: QUICK_CODES.filter((item) =>
          analyzedDigits.includes(item.code),
        ),
      },
      normalized: normalized.digits,
    };
  }

  if (mode === "number" && normalized.digits.length < 2) {
    return {
      error: "Nhập ít nhất 2 chữ số để bắt đầu xem.",
      normalized: normalized.digits,
    };
  }

  let analyzedDigits = normalized.digits;
  if (mode === "phone") analyzedDigits = normalized.digits.slice(1);
  if (mode === "cccd" && analyzedDigits.startsWith("0")) {
    analyzedDigits = analyzedDigits.slice(1);
  }

  const sequence =
    mode === "cccd"
      ? analyzeCccdDigits(analyzedDigits)
      : analyzeGenericDigits(analyzedDigits);
  const counts = countEnergies(sequence.pairs);
  const classified = sequence.pairs.filter((pair) => pair.energyId);
  const endingPair = classified.at(-1);
  const catCount = classified.filter(
    (pair) => pair.energyId && ENERGIES[pair.energyId].polarity === "cat",
  ).length;
  const hungCount = classified.filter(
    (pair) => pair.energyId && ENERGIES[pair.energyId].polarity === "hung",
  ).length;

  const result: AnalysisResult = {
    mode,
    normalizedInput: normalized.digits,
    analyzedDigits,
    pairs: sequence.pairs,
    transitions: buildTransitions(sequence.pairs),
    counts,
    dominantEnergies: findDominants(counts),
    endingEnergy: endingPair?.energyId,
    endingStrength: endingPair?.strength,
    catCount,
    hungCount,
    strongClusters: findStrongClusters(sequence.pairs),
    specialWarnings: sequence.warnings,
    quickCodeMatches: QUICK_CODES.filter((item) =>
      analyzedDigits.includes(item.code),
    ),
    tailDigits: mode === "phone" ? analyzedDigits.slice(-4) : undefined,
    fortuneCycles:
      mode === "cccd" ? buildFortuneCycles(normalized.digits) : undefined,
  };

  return { result, normalized: normalized.digits };
}

export function getEnergyPairs(energyId: EnergyId): PairRule[] {
  return Object.values(PAIR_RULES)
    .filter((rule) => rule.energyId === energyId)
    .sort(
      (left, right) =>
        left.strength - right.strength ||
        left.pair.localeCompare(right.pair),
    );
}

export function getPolarityLabel(polarity: Polarity): string {
  return polarity === "cat" ? "Cát tinh" : "Hung tinh";
}

export function getEnergyNameWithStrength(
  energyId: EnergyId,
  strength?: StrengthLevel,
): string {
  const name = ENERGIES[energyId].name;
  return strength ? `${name} ${getCircledStrength(strength)}` : name;
}

export function getCircledStrength(level: StrengthLevel): string {
  return ({ 1: "①", 2: "②", 3: "③", 4: "④" } as const)[level];
}

export function getHungConversionGuidance(
  energyId?: EnergyId,
): HungConversionGuidance | undefined {
  return energyId ? HUNG_CONVERSION_GUIDANCE[energyId] : undefined;
}

export function getStrengthLabel(level?: StrengthLevel): string {
  if (!level) return "Đặc biệt";
  return level === 1
    ? "Bậc 1 · Mạnh nhất"
    : level === 2
      ? "Bậc 2 · Mạnh"
      : level === 3
        ? "Bậc 3 · Vừa"
        : "Bậc 4 · Nhẹ";
}
