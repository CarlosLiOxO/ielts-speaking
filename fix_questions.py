"""
修复题库 JSON 中 OCR 产生的字母间隔问题
策略：
1. 整句替换（最严重的破损句子）
2. 正则规则替换（常见词内空格）
3. 通用短词合并（基于拼写检查）
"""
import json
import re

# ===== 整句替换（原文 → 正确文本）=====
SENTENCE_FIXES = {
    "Do you l ik e to r e m e m be r t h in g s?": "Do you like to remember things?",
    "Do you o ft e n s t a y up l at e?": "Do you often stay up late?",
    "Do you often t a k e p h o to s?": "Do you often take photos?",
    "What does it feel like the next morning if you stay up late?": "What does it feel like the next morning if you stay up late?",
    "What dose it feel like the next morning if you stay up late?": "What does it feel like the next morning if you stay up late?",
    "Will you make the list for stud ing/shopping/…?": "Will you make the list for studying/shopping/...?",
    "Will you make the list for studying/shopping/…?": "Will you make the list for studying/shopping/...?",
    "Who will you turn for to repair if the machine is broke down?": "Who will you turn to for repair if the machine breaks down?",
    "Housework 务": "Housework 家务",
    "Is there anyone around you who likes flowers ve y much?": "Is there anyone around you who likes flowers very much?",
    "If you need to do something for a long time how do you feel?": "If you need to do something for a long time, how do you feel?",
    "Do you have di fficul ties in memorizing?": "Do you have difficulties in memorizing?",
    "Do people's memory better no w or in childhood?": "Do people's memory better now or in childhood?",
    "How to remember something impor tant?": "How to remember something important?",
    "Do you think patience is impor tant for work and study?": "Do you think patience is important for work and study?",
    "What do you feel impati ent about when doing?": "What do you feel impatient about when doing?",
    "Do you have more free time than bef re?": "Do you have more free time than before?",
    "Which day do you have more free time on, Saturda y or Sunday?": "Which day do you have more free time on, Saturday or Sunday?",
    "Are you willing to coo k for a grou p of people?": "Are you willing to cook for a group of people?",
    "Would you like to learn the ski ll of cooking?": "Would you like to learn the skill of cooking?",
    "Will you often tidy your room?": "Will you often tidy your room?",
    "Will you print photos?": "Will you print photos?",
    "Is there an y technological tool s that you wan t to bu y but expensive?": "Is there any technological tools that you want to buy but expensive?",
    "Do you use paper or your cel lphone to mak e the lists?": "Do you use paper or your cellphone to make the lists?",
    "Do you often organi e a thorough cleaning?": "Do you often organise a thorough cleaning?",
    "Which is the most commonl y used machine in your home?": "Which is the most commonly used machine in your home?",
    "Are there man y flowers near your home?": "Are there many flowers near your home?",
    "Have you receive a mobile phone as a gift?": "Have you received a mobile phone as a gift?",
    "Do you often broken or lose your mobile phone?": "Do you often break or lose your mobile phone?",
    "What are the benefits of making the list? Do you think it is useful to": "What are the benefits of making a list? Do you think it is useful?",
    "How much mone y do you usually spend on shoes?": "How much money do you usually spend on shoes?",
    "Do you like to bu y shoes online or offline?": "Do you like to buy shoes online or offline?",
    "When you were studyin g it, did anyon e hel p you? How di d the y help": "When you were studying it, did anyone help you? How did they help?",
    "Befor e you started this subject, di d you think it was difficult?": "Before you started this subject, did you think it was difficult?",
    "Have you ever lent a boo k to your fiend?": "Have you ever lent a book to your friend?",
    "Would you len d your phone to your fiend?": "Would you lend your phone to your friend?",
    "How often would you g o there?": "How often would you go there?",
    "Do you think it is easy to gro w vegetables?": "Do you think it is easy to grow vegetables?",
    "Why do you need to tak e a break?": "Why do you need to take a break?",
    "Have you ever taken a na p when studying?": "Have you ever taken a nap when studying?",
    "Why do people like to giv e flowers as gifts?": "Why do people like to give flowers as gifts?",
    "Where do you like to g o in that area?": "Where do you like to go in that area?",
    "What part do you love mos t in the place?": "What part do you love most in the place?",
    "Do you live al ong or with others?": "Do you live alone or with others?",
    "Do you sometimes feel that you hav e to study too hard?": "Do you sometimes feel that you have to study too hard?",
    "Do you prefer to study in the mor nin g or in the afternoon?": "Do you prefer to study in the morning or in the afternoon?",
    "Have you ever sen t messages to express gratitude?": "Have you ever sent messages to express gratitude?",
    "Do you like to make alist?": "Do you like to make a list?",
    "Why did you use it las t time?": "Why did you use it last time?",
    "Do you kee p pl ants at home?": "Do you keep plants at home?",
    "Which do you prefer, comfortabl e shoes or pretty shoes?": "Which do you prefer, comfortable shoes or pretty shoes?",
    "Do you like to chat with f iends?": "Do you like to chat with friends?",
    "What do you cha t about when meeting friends?": "What do you chat about when meeting friends?",
    "Do you prefe r chatting online or face to face?": "Do you prefer chatting online or face to face?",
    "Do you think people are chattin g more and more these days?": "Do you think people are chatting more and more these days?",
    "Do many people gro w vegetable in your city?": "Do many people grow vegetables in your city?",
    "Do you often remembe r the information in the advertisement?": "Do you often remember the information in the advertisement?",
    "Do you like listenin g to music in public leisur e places?": "Do you like listening to music in public leisure places?",
    "Whic h is your favourite room in your home?": "Which is your favourite room in your home?",
    "What w ll make your home more comfortable/happy?": "What will make your home more comfortable/happy?",
    "What is your m jor? Why did you choose that subject?": "What is your major? Why did you choose that subject?",
    "Are you lookin g forward to working?": "Are you looking forward to working?",
    "Is your job connect to your colleg e major?": "Is your job connected to your college major?",
    "Do you of ten do sports?": "Do you often do sports?",
    "Is there a crowded place near where you live?": "Is there a crowded place near where you live?",
}

# ===== 正则规则（词内空格修复）=====
PATTERNS = [
    # 严重破碎的整词
    (r'\bWhic h\b', 'Which'), (r'\bWhi ch\b', 'Which'),
    (r'\bw ll\b', 'will'), (r'\bW ll\b', 'Will'), (r'\bW l l\b', 'Will'),
    (r'\bWi l\b', 'Will'),  # "Wi l" → "Will" (missing second l)
    (r'\bWillyou\b', 'Will you'),  # "Willyou" → "Will you" (no space)
    (r'\bI f\b', 'If'),  # "I f" → "If"
    (r'\btool s\b', 'tools'),  # "tool s" → "tools"
    (r'\bstud ing\b', 'studying'), (r'\bstu dying\b', 'studying'),
    # 常见词内分裂修复
    (r'\bdi nner\b', 'dinner'), (r'\bdin ner\b', 'dinner'),
    (r'\bf i end s\b', 'friends'), (r'\bf i end\b', 'friend'),
    (r'\bthi n k\b', 'think'), (r'\bthin k\b', 'think'),
    (r'\btel l\b', 'tell'), (r'\bt ell\b', 'tell'),
    (r'\bf mil y\b', 'family'), (r'\bfam ily\b', 'family'), (r'\bfami ly\b', 'family'),
    (r'\bbusi ness\b', 'business'), (r'\bbusiness\b', 'business'),
    (r'\brea d\b', 'read'), (r'\br ead\b', 'read'),
    (r'\bservi ces\b', 'services'), (r'\bservice s\b', 'services'),
    (r'\bli k e\b', 'like'), (r'\blik e\b', 'like'),
    (r'\bsh e\b', 'she'), (r'\bh e\b', 'he'),
    (r'\bwh o\b', 'who'), (r'\bw ho\b', 'who'),
    (r'\bag e\b', 'age'), (r'\ba ge\b', 'age'),
    (r'\blearni ng\b', 'learning'), (r'\blear ning\b', 'learning'),
    (r'\bstag e\b', 'stage'), (r'\bst age\b', 'stage'),
    (r'\bl f\b', 'life'), (r'\bli fe\b', 'life'),
    (r'\bf o d\b', 'food'), (r'\bf ood\b', 'food'),
    (r'\bwak e\b', 'wake'), (r'\bwa ke\b', 'wake'),
    (r'\bkin d\b', 'kind'), (r'\bki nd\b', 'kind'),
    (r'\bhealthi er\b', 'healthier'), (r'\bhealth ier\b', 'healthier'),
    (r'\bli ving\b', 'living'), (r'\bliv ing\b', 'living'),
    (r'\bimpressi ve\b', 'impressive'), (r'\bimpressive\b', 'impressive'),
    (r'\bcl ass\b', 'class'), (r'\bcla ss\b', 'class'),
    (r'\bforei g n\b', 'foreign'), (r'\bfor eign\b', 'foreign'),
    (r'\buncl e\b', 'uncle'), (r'\bun cle\b', 'uncle'),
    (r'\buse d\b', 'used'), (r'\bu sed\b', 'used'),
    (r'\bn impressi ve\b', 'n impressive'),  # "an impressive" fix
    (r'\bwoul d\b', 'would'),
    (r'\bm jor\b', 'major'),
    (r'\blookin g\b', 'looking'), (r'\bstudyin g\b', 'studying'),
    (r'\bchattin g\b', 'chatting'), (r'\blistenin g\b', 'listening'),
    (r'\bcomfortabl e\b', 'comfortable'),
    (r'\bcolleg e\b', 'college'),
    (r'\bkee p\b', 'keep'), (r'\bpl ants\b', 'plants'),
    (r'\bf iends\b', 'friends'), (r'\bf iend\b', 'friend'),
    (r'\bcha t\b', 'chat'), (r'\bprefe r\b', 'prefer'),
    (r'\bgro w\b', 'grow'), (r'\bgiv e\b', 'give'),
    (r'\bremembе r\b', 'remember'), (r'\bremembе\b', 'remember'),
    # 常见功能词
    (r'\bWha t\b', 'What'), (r'\bW ha t\b', 'What'), (r'\bW h a t\b', 'What'),
    (r'\bHo w\b', 'How'), (r'\bH ow\b', 'How'),
    (r'\bWh y\b', 'Why'), (r'\bW hy\b', 'Why'),
    (r'\bWhe re\b', 'Where'), (r'\bWh ere\b', 'Where'),
    (r'\bWhe n\b', 'When'), (r'\bW hen\b', 'When'),
    (r'\bWhi ch\b', 'Which'), (r'\bWh ich\b', 'Which'),
    (r'\bWil l\b', 'Will'), (r'\bWi l l\b', 'Will'), (r'\bWi ll\b', 'Will'),
    (r'\bD o\b', 'Do'), (r'\bD oes\b', 'Does'), (r'\bD id\b', 'Did'),
    (r'\bI s\b', 'Is'), (r'\bAr e\b', 'Are'), (r'\bHa ve\b', 'Have'),
    (r'\bCa n\b', 'Can'), (r'\bWoul d\b', 'Would'), (r'\bCoul d\b', 'Could'),
    (r'\bSho uld\b', 'Should'), (r'\bShou ld\b', 'Should'),
    # 小写功能词
    (r'\bd o\b', 'do'), (r'\bt o\b', 'to'), (r'\bi n\b', 'in'),
    (r'\bi t\b', 'it'), (r'\bi s\b', 'is'), (r'\bo r\b', 'or'),
    (r'\bo f\b', 'of'), (r'\ba t\b', 'at'), (r'\bb e\b', 'be'),
    (r'\bb y\b', 'by'), (r'\ba s\b', 'as'), (r'\bu p\b', 'up'),
    (r'\bo n\b', 'on'), (r'\bi f\b', 'if'), (r'\bs o\b', 'so'),
    (r'\bt he\b', 'the'), (r'\bth e\b', 'the'),
    (r'\ba nd\b', 'and'), (r'\bfo r\b', 'for'), (r'\bf or\b', 'for'),
    (r'\bf r\b', 'for'), (r'\bno t\b', 'not'), (r'\bar e\b', 'are'),
    (r'\bha ve\b', 'have'), (r'\byo u\b', 'you'), (r'\by ou\b', 'you'),
    (r'\by o u\b', 'you'), (r'\byou r\b', 'your'), (r'\byo ur\b', 'your'),
    (r'\by our\b', 'your'), (r'\bwha t\b', 'what'), (r'\bwh at\b', 'what'),
    (r'\bwhe re\b', 'where'), (r'\bwh ere\b', 'where'),
    (r'\bwhe n\b', 'when'), (r'\bwh en\b', 'when'),
    (r'\bwh y\b', 'why'), (r'\bho w\b', 'how'),
    (r'\bwil l\b', 'will'), (r'\bwi ll\b', 'will'),
    (r'\bwoul d\b', 'would'), (r'\bcoul d\b', 'could'), (r'\bshoul d\b', 'should'),
    (r'\btha t\b', 'that'), (r'\bth at\b', 'that'),
    (r'\bthei r\b', 'their'), (r'\bthe re\b', 'there'),
    (r'\bthi s\b', 'this'), (r'\bth is\b', 'this'),
    (r'\bwhi ch\b', 'which'), (r'\bwh ich\b', 'which'),
    (r'\bfro m\b', 'from'), (r'\bfr om\b', 'from'),
    (r'\bwit h\b', 'with'), (r'\bwi th\b', 'with'),
    (r'\babou t\b', 'about'), (r'\bab out\b', 'about'),
    (r'\bthin k\b', 'think'), (r'\blik e\b', 'like'), (r'\bli ke\b', 'like'),
    (r'\bli v e\b', 'live'), (r'\bliv e\b', 'live'),
    (r'\bpeopl e\b', 'people'), (r'\bpeop le\b', 'people'),
    (r'\bplac e\b', 'place'), (r'\bpl ace\b', 'place'),
    (r'\btim e\b', 'time'), (r'\bti me\b', 'time'),
    (r'\bhom e\b', 'home'), (r'\bho me\b', 'home'),
    (r'\bhous e\b', 'house'), (r'\bho use\b', 'house'),
    (r'\bstud y\b', 'study'), (r'\bstu dy\b', 'study'),
    (r'\blear n\b', 'learn'), (r'\ble arn\b', 'learn'),
    (r'\bkno w\b', 'know'), (r'\bkn ow\b', 'know'),
    (r'\bwork\b', 'work'), (r'\bwor k\b', 'work'),
    (r'\bthi nk\b', 'think'),
    (r'\bdisl ike\b', 'dislike'), (r'\bdis like\b', 'dislike'),
    (r'\bdi slike\b', 'dislike'), (r'\bd islike\b', 'dislike'),
    (r'\bfavouri te\b', 'favourite'), (r'\bfavor ite\b', 'favorite'),
    (r'\bf vourite\b', 'favourite'), (r'\bf avorite\b', 'favorite'),
    (r'\bhistor y\b', 'history'), (r'\bhi story\b', 'history'),
    (r'\bhisto ry\b', 'history'), (r'\bhi to y\b', 'history'),
    (r'\bmorni ng\b', 'morning'), (r'\bmor ning\b', 'morning'),
    (r'\bmorning\b', 'morning'),
    (r'\bafter noon\b', 'afternoon'), (r'\bafternoon\b', 'afternoon'),
    (r'\bman y\b', 'many'), (r'\bma ny\b', 'many'),
    (r'\bve y\b', 'very'), (r'\bver y\b', 'very'),
    (r'\bof ten\b', 'often'), (r'\bo ften\b', 'often'), (r'\boft en\b', 'often'),
    (r'\bof t e n\b', 'often'),
    (r'\bbrok e\b', 'broke'), (r'\bbr oke\b', 'broke'),
    (r'\bthank s\b', 'thanks'), (r'\bthan ks\b', 'thanks'),
    (r'\bbef re\b', 'before'), (r'\bno w\b', 'now'),
    (r'\bl t e\b', 'late'), (r'\bfe e l\b', 'feel'),
    (r'\bdos e\b', 'does'), (r'\bfee I\b', 'feel'),
    (r'\ban d\b', 'and'),
    (r'\bna p\b', 'nap'), (r'\bg o\b', 'go'), (r'\bmos t\b', 'most'),
    (r'\bal ong\b', 'alone'), (r'\balone\b', 'alone'),
    (r'\bhav e\b', 'have'), (r'\bdi d\b', 'did'), (r'\bthe y\b', 'they'),
    (r'\bth ey\b', 'they'), (r'\bboo k\b', 'book'), (r'\blen d\b', 'lend'),
    (r'\bbef ore\b', 'before'), (r'\bbefor e\b', 'before'),
    (r'\banyon e\b', 'anyone'), (r'\bany one\b', 'anyone'),
    (r'\bhel p\b', 'help'), (r'\bta ke\b', 'take'), (r'\btak e\b', 'take'),
    (r'\bsen t\b', 'sent'), (r'\blas t\b', 'last'),
    (r'\bSaturda y\b', 'Saturday'), (r'\bSatur day\b', 'Saturday'),
    (r'\bmone y\b', 'money'), (r'\bmo ney\b', 'money'),
    (r'\bstudi e s\b', 'studies'), (r'\bstudies\b', 'studies'),
    (r'\bimpor tant\b', 'important'), (r'\bimportan t\b', 'important'),
    (r'\bimpati ent\b', 'impatient'), (r'\bimpatient\b', 'impatient'),
    (r'\bdi fficul ties\b', 'difficulties'),
    (r'\bcommonl y\b', 'commonly'), (r'\bcommon ly\b', 'commonly'),
    (r'\bgrou p\b', 'group'), (r'\bgr oup\b', 'group'),
    (r'\bski ll\b', 'skill'), (r'\bskil l\b', 'skill'),
    (r'\btid y\b', 'tidy'), (r'\bti dy\b', 'tidy'),
    (r'\borganis e\b', 'organise'), (r'\borgani e\b', 'organise'),
    (r'\bcoo k\b', 'cook'), (r'\bco ok\b', 'cook'),
    (r'\bbu y\b', 'buy'), (r'\bb uy\b', 'buy'),
    (r'\bcel lphone\b', 'cellphone'), (r'\bcell phone\b', 'cellphone'),
    (r'\bmak e\b', 'make'), (r'\bma ke\b', 'make'),
    (r'\ban y\b', 'any'), (r'\ba ny\b', 'any'),
    (r'\bwan t\b', 'want'), (r'\bwa nt\b', 'want'),
    (r'\bfee l\b', 'feel'), (r'\bfe el\b', 'feel'),
    (r'\blo ng\b', 'long'), (r'\blon g\b', 'long'),
    (r'\bstayin g\b', 'staying'), (r'\bstay ing\b', 'staying'),
    (r'\bsta y\b', 'stay'), (r'\bst ay\b', 'stay'),
    (r'\bki d\b', 'kid'), (r'\bk id\b', 'kid'),
    (r'\bphon e\b', 'phone'), (r'\bpho ne\b', 'phone'),
    (r'\bflo wers\b', 'flowers'), (r'\bf lowers\b', 'flowers'),
    (r'\bf owers\b', 'flowers'),
    (r'\bleisur e\b', 'leisure'), (r'\bleisu re\b', 'leisure'),
    (r'\blisteni ng\b', 'listening'),
    (r'\bchatt ing\b', 'chatting'), (r'\bchat ting\b', 'chatting'),
    (r'\bremember\b', 'remember'),
    (r'\bremembе r\b', 'remember'),
    (r'\ba lso\b', 'also'), (r'\bal so\b', 'also'),
    (r'\bbecaus e\b', 'because'), (r'\bbec ause\b', 'because'),
    (r'\bDo yo u\b', 'Do you'), (r'\bD o you\b', 'Do you'),
    (r'\bHo w often\b', 'How often'), (r'\bHo w much\b', 'How much'),
    (r'\bHo w many\b', 'How many'), (r'\bHo w long\b', 'How long'),
    (r'\bHo w do\b', 'How do'), (r'\bHo w does\b', 'How does'),
    (r'\bHo w did\b', 'How did'),
    (r'\bWha t kind\b', 'What kind'), (r'\bWha t type\b', 'What type'),
    (r'\bWha t do\b', 'What do'), (r'\bWha t is\b', 'What is'),
    (r'\bWha t are\b', 'What are'), (r'\bWha t have\b', 'What have'),
    (r'\bcomfortab le\b', 'comfortable'), (r'\bcomfort able\b', 'comfortable'),
    (r'\bsometi mes\b', 'sometimes'), (r'\bsometime s\b', 'sometimes'),
    (r'\bneve r\b', 'never'), (r'\bnev er\b', 'never'),
    (r'\busual ly\b', 'usually'), (r'\busuall y\b', 'usually'),
    (r'\breal ly\b', 'really'), (r'\breall y\b', 'really'),
    (r'\bactual ly\b', 'actually'), (r'\bactually\b', 'actually'),
    (r'\bdefinitel y\b', 'definitely'), (r'\bdefin itely\b', 'definitely'),
    (r'\bprobab ly\b', 'probably'), (r'\bprobabl y\b', 'probably'),
    (r'\brecent ly\b', 'recently'), (r'\brecently\b', 'recently'),
    (r'\bgradual ly\b', 'gradually'), (r'\bgradually\b', 'gradually'),
    (r'\bspecial ly\b', 'specially'), (r'\bespecial ly\b', 'especially'),
    (r'\bespecially\b', 'especially'),
    (r'\bparticul arly\b', 'particularly'), (r'\bparticularly\b', 'particularly'),
    (r'\bsignificant ly\b', 'significantly'),
    (r'\bpersonal ly\b', 'personally'),
    (r'\bcompletel y\b', 'completely'),
    (r'\brelative ly\b', 'relatively'),
    (r'\btyp ically\b', 'typically'), (r'\btypical ly\b', 'typically'),
    (r'\bnormal ly\b', 'normally'),
    (r'\bgenerall y\b', 'generally'),
    (r'\bexperien ce\b', 'experience'), (r'\bexperience\b', 'experience'),
    (r'\btechnolog y\b', 'technology'), (r'\btechno logy\b', 'technology'),
    (r'\beducati on\b', 'education'), (r'\beducation\b', 'education'),
    (r'\binformat ion\b', 'information'), (r'\binformation\b', 'information'),
    (r'\bopportunit y\b', 'opportunity'), (r'\bopportunity\b', 'opportunity'),
    (r'\benviro nment\b', 'environment'), (r'\benvironmen t\b', 'environment'),
    (r'\benvironmental\b', 'environmental'),
    (r'\bcommunity\b', 'community'), (r'\bcommunit y\b', 'community'),
    (r'\brelationship\b', 'relationship'), (r'\brelationshi p\b', 'relationship'),
    (r'\bdevelopment\b', 'development'), (r'\bdevelopmen t\b', 'development'),
    (r'\bgovernment\b', 'government'), (r'\bgovernmen t\b', 'government'),
    (r'\borganization\b', 'organization'), (r'\borganizati on\b', 'organization'),
    (r'\bpopulation\b', 'population'), (r'\bpopulati on\b', 'population'),
    (r'\bgeneration\b', 'generation'), (r'\bgenerati on\b', 'generation'),
    (r'\bcompetition\b', 'competition'), (r'\bcompetiti on\b', 'competition'),
    (r'\bcommunication\b', 'communication'), (r'\bcommunicati on\b', 'communication'),
    (r'\bconversation\b', 'conversation'), (r'\bconversati on\b', 'conversation'),
    (r'\bdiscussion\b', 'discussion'), (r'\bdiscussi on\b', 'discussion'),
    (r'\bpresentation\b', 'presentation'), (r'\bpresentati on\b', 'presentation'),
    (r'\bunderstanding\b', 'understanding'), (r'\bunderstand ing\b', 'understanding'),
    (r'\bachievement\b', 'achievement'), (r'\bachieve ment\b', 'achievement'),
    (r'\bsatisfaction\b', 'satisfaction'), (r'\bsatisfacti on\b', 'satisfaction'),
    (r'\bcooperation\b', 'cooperation'), (r'\bcooperati on\b', 'cooperation'),
    (r'\bcolleg e\b', 'college'), (r'\bcol lege\b', 'college'),
    (r'\buniversit y\b', 'university'), (r'\buniversi ty\b', 'university'),
    (r'\barchitect ure\b', 'architecture'), (r'\barchitecture\b', 'architecture'),
    (r'\bheritage\b', 'heritage'), (r'\bherit age\b', 'heritage'),
    (r'\btraditiona l\b', 'traditional'), (r'\btraditional\b', 'traditional'),
    (r'\bprofession al\b', 'professional'), (r'\bprofessional\b', 'professional'),
    (r'\bcomparison\b', 'comparison'), (r'\bcompari son\b', 'comparison'),
    (r'\bdifference\b', 'difference'), (r'\bdifferen ce\b', 'difference'),
    (r'\badvantage\b', 'advantage'), (r'\badvant age\b', 'advantage'),
    (r'\bchallenge\b', 'challenge'), (r'\bchallen ge\b', 'challenge'),
    (r'\bconnection\b', 'connection'), (r'\bconnecti on\b', 'connection'),
    (r'\binteraction\b', 'interaction'), (r'\binteracti on\b', 'interaction'),
    (r'\bpollution\b', 'pollution'), (r'\bpolluti on\b', 'pollution'),
    (r'\btransportation\b', 'transportation'), (r'\btransportat ion\b', 'transportation'),
    (r'\bconvenient\b', 'convenient'), (r'\bconvenien t\b', 'convenient'),
    (r'\bsustainab le\b', 'sustainable'), (r'\bsustainable\b', 'sustainable'),
    # 额外补充
    (r'\bextrem e\b', 'extreme'), (r'\bextr eme\b', 'extreme'),
    (r'\bsport s\b', 'sports'), (r'\bspor ts\b', 'sports'),
    (r'\bbuilding s\b', 'buildings'), (r'\bbuild ings\b', 'buildings'),
    (r'\bsel l\b', 'sell'), (r'\bsel ls\b', 'sells'),
    (r'\bdiffi cult\b', 'difficult'), (r'\bdiff icult\b', 'difficult'),
    (r'\btha n\b', 'than'), (r'\bt han\b', 'than'),
    (r'\bmusi c\b', 'music'), (r'\bmus ic\b', 'music'),
    (r'\bnegati ve\b', 'negative'), (r'\bneg ative\b', 'negative'),
    (r'\bimpac t\b', 'impact'), (r'\bim pact\b', 'impact'),
    (r'\bpref r\b', 'prefer'),
    (r'\bdifferen t\b', 'different'), (r'\bdiff rent\b', 'different'),
    (r'\bsho w\b', 'show'), (r'\bsh ow\b', 'show'),
    (r'\badul ts\b', 'adults'), (r'\badul t\b', 'adult'),
    (r'\bempl oyees\b', 'employees'), (r'\bemploye es\b', 'employees'),
    (r'\bchi ldren\b', 'children'), (r'\bchil dren\b', 'children'), (r'\bchi l dren\b', 'children'),
    (r'\belectri city\b', 'electricity'), (r'\belec tricity\b', 'electricity'),
    (r'\bvegetar ians\b', 'vegetarians'), (r'\bvege tarians\b', 'vegetarians'),
    (r'\bofte n\b', 'often'), (r'\boft en\b', 'often'),
    (r'\badvantage s\b', 'advantages'), (r'\badvant ages\b', 'advantages'),
    (r'\bdisadvantage s\b', 'disadvantages'),
    (r'\breasoabl e\b', 'reasonable'), (r'\breasonabl e\b', 'reasonable'),
    (r'\bonl ine\b', 'online'), (r'\bon line\b', 'online'),
    (r'\bbac k\b', 'back'), (r'\bb ack\b', 'back'),
    (r'\binf rmation\b', 'information'), (r'\binfo rmation\b', 'information'),
    (r'\bprovid e\b', 'provide'), (r'\bpro vide\b', 'provide'),
    (r'\bpl ans\b', 'plans'), (r'\bpla ns\b', 'plans'),
    (r'\bf llow\b', 'follow'), (r'\bfol low\b', 'follow'),
    (r'\btopi cs\b', 'topics'), (r'\btop ics\b', 'topics'),
    (r'\bnoti ce\b', 'notice'), (r'\bnot ice\b', 'notice'),
    (r'\bdar k\b', 'dark'), (r'\bd ark\b', 'dark'),
    (r'\badver tising\b', 'advertising'), (r'\badvert ising\b', 'advertising'),
    (r'\bbenef its\b', 'benefits'), (r'\bbene fits\b', 'benefits'),
    (r'\bhabit s\b', 'habits'), (r'\bha bits\b', 'habits'),
    (r'\brecen t\b', 'recent'), (r'\brece nt\b', 'recent'),
    (r'\bdisappea r\b', 'disappear'), (r'\bdisap pear\b', 'disappear'),
    (r'\bel de r\b', 'elder'), (r'\beld er\b', 'elder'),
    (r'\bfri endl y\b', 'friendly'), (r'\bfriend ly\b', 'friendly'),
    (r'\blif e\b', 'life'), (r'\bli fe\b', 'life'),
    (r'\blif\b', 'life'),
    (r'\bsomethin g\b', 'something'), (r'\bsome thing\b', 'something'),
    (r'\bgramma r\b', 'grammar'), (r'\bgram mar\b', 'grammar'),
    (r'\blearnin g\b', 'learning'), (r'\blearn ing\b', 'learning'),
    (r'\bpaintin g\b', 'painting'), (r'\bpaint ing\b', 'painting'),
    (r'\bgoa l s\b', 'goals'), (r'\bgoal s\b', 'goals'),
    (r'\ba n\b', 'an'),
    (r'\bbrea k\b', 'break'), (r'\bbr eak\b', 'break'),
    (r'\bski ls\b', 'skills'), (r'\bskil ls\b', 'skills'),
    (r'\bf od\b', 'food'), (r'\bfo od\b', 'food'),
    (r'\bpl ac e\b', 'place'), (r'\bpla ce\b', 'place'),
    (r'\bcit y\b', 'city'), (r'\bci ty\b', 'city'),
    (r'\bpubli c\b', 'public'), (r'\bpub lic\b', 'public'),
    (r'\bjourn ey\b', 'journey'), (r'\bjour ney\b', 'journey'),
    (r'\bmov ie s\b', 'movies'), (r'\bmov ie\b', 'movie'),
    (r'\bsociet y\b', 'society'), (r'\bsoci ety\b', 'society'),
    (r'\bfrequentl y\b', 'frequently'), (r'\bfrequent ly\b', 'frequently'),
    (r'\bconf ident\b', 'confident'), (r'\bconfiden t\b', 'confident'),
    (r'\bsimpl e\b', 'simple'), (r'\bsim ple\b', 'simple'),
    (r'\bworri ed\b', 'worried'), (r'\bworr ied\b', 'worried'),
    (r'\bcompan y\b', 'company'), (r'\bcom pany\b', 'company'),
    (r'\bconnect ed\b', 'connected'),
    (r'\bpref er\b', 'prefer'), (r'\bprefe r\b', 'prefer'),
    (r'\bimpress ive\b', 'impressive'), (r'\bimpressi ve\b', 'impressive'),
    (r'\bcl ass\b', 'class'), (r'\bcla ss\b', 'class'),
    (r'\bforei g n\b', 'foreign'), (r'\bfor eign\b', 'foreign'),
    (r'\buncl e\b', 'uncle'), (r'\bun cle\b', 'uncle'),
    (r'\buse d\b', 'used'), (r'\bu sed\b', 'used'),
    (r'\bdinner\b', 'dinner'), (r'\bdi nner\b', 'dinner'),
    (r'\bfriend s\b', 'friends'), (r'\bfrien ds\b', 'friends'),
    (r'\bfamil y\b', 'family'), (r'\bfam ily\b', 'family'),
    (r'\bbusiness\b', 'business'), (r'\bbusi ness\b', 'business'),
    (r'\bread\b', 'read'), (r'\brea d\b', 'read'),
    (r'\bservices\b', 'services'), (r'\bservi ces\b', 'services'),
    (r'\bhealth ier\b', 'healthier'), (r'\bhealthi er\b', 'healthier'),
    (r'\bliving\b', 'living'), (r'\bli ving\b', 'living'),
    (r'\bemployees\b', 'employees'), (r'\bempl oyees\b', 'employees'),
    (r'\bchildren\b', 'children'), (r'\bchi ldren\b', 'children'),
    (r'\benergy\b', 'energy'), (r'\bener gy\b', 'energy'),
    (r'\bweath er\b', 'weather'), (r'\bweather\b', 'weather'),
    (r'\bopen l y\b', 'openly'), (r'\bopen ly\b', 'openly'),
    (r'\bfriendl y\b', 'friendly'), (r'\bfri endly\b', 'friendly'),
    (r'\bjourne y\b', 'journey'),
    # 词尾分裂（末尾字母被空格隔开）
    (r'\bdifficul t\b', 'difficult'), (r'\bdi f icul t\b', 'difficult'), (r'\bdiffi cul t\b', 'difficult'),
    (r'\bjo b\b', 'job'), (r'\bj ob\b', 'job'),
    (r'\bne w\b', 'new'), (r'\bn ew\b', 'new'),
    (r'\bafte r\b', 'after'), (r'\baf ter\b', 'after'),
    (r'\bkne w\b', 'knew'), (r'\bkn ew\b', 'knew'),
    (r'\bmad e\b', 'made'), (r'\bma de\b', 'made'),
    (r'\bprepar e\b', 'prepare'), (r'\bprep are\b', 'prepare'),
    (r'\bhi s\b', 'his'), (r'\bh is\b', 'his'),
    (r'\bhi m\b', 'him'), (r'\bh im\b', 'him'),
    (r'\bf lt\b', 'felt'), (r'\bfe lt\b', 'felt'),
    (r'\bf elings\b', 'feelings'), (r'\bfeel ings\b', 'feelings'),
    (r'\bf el\b', 'feel'), (r'\bfe l\b', 'feel'),
    (r'\bf ce\b', 'face'), (r'\bfa ce\b', 'face'),
    (r'\bf reigner\b', 'foreigner'), (r'\bforeign er\b', 'foreigner'),
    (r'\bvisi t\b', 'visit'), (r'\bvis it\b', 'visit'),
    (r'\bmigh t\b', 'might'), (r'\bmi ght\b', 'might'),
    (r'\bproduc e d\b', 'produced'), (r'\bproduc ed\b', 'produced'), (r'\bproduce d\b', 'produced'),
    (r'\bproduc t\b', 'product'), (r'\bpro duct\b', 'product'),
    (r'\brel y\b', 'rely'), (r'\br ely\b', 'rely'),
    (r'\bfamou s\b', 'famous'), (r'\bfa mous\b', 'famous'),
    (r'\bwai t\b', 'wait'), (r'\bwa it\b', 'wait'),
    (r'\bgo t\b', 'got'), (r'\bg ot\b', 'got'),
    (r'\bwaitin g\b', 'waiting'), (r'\bwait ing\b', 'waiting'),
    (r'\bfoun d\b', 'found'), (r'\bfo und\b', 'found'),
    (r'\belectri c\b', 'electric'), (r'\belect ric\b', 'electric'),
    (r'\benjo y\b', 'enjoy'), (r'\ben joy\b', 'enjoy'),
    (r'\bsong s\b', 'songs'), (r'\bso ngs\b', 'songs'),
    (r'\bloo k\b', 'look'), (r'\bl ook\b', 'look'), (r'\bl oo k\b', 'look'),
    (r'\bothe r\b', 'other'), (r'\bot her\b', 'other'),
    (r'\badverti sement\b', 'advertisement'), (r'\badvertise ment\b', 'advertisement'),
    (r'\baffec t\b', 'affect'), (r'\baf fect\b', 'affect'),
    (r'\bkind s\b', 'kinds'), (r'\bkin ds\b', 'kinds'),
    (r'\bprogramme s\b', 'programmes'), (r'\bpro grammes\b', 'programmes'),
    (r'\bmor e\b', 'more'), (r'\bm ore\b', 'more'),
    (r'\bdiff r\b', 'differ'), (r'\bdiffer\b', 'differ'),
    (r'\bfirs t\b', 'first'), (r'\bfir st\b', 'first'),
    (r'\bwhethe r\b', 'whether'), (r'\bwheth er\b', 'whether'),
    (r'\bpersuad e\b', 'persuade'), (r'\bpersua de\b', 'persuade'),
    (r'\bparent s\b', 'parents'), (r'\bpar ents\b', 'parents'),
    (r'\bapar tment\b', 'apartment'), (r'\bapart ment\b', 'apartment'),
    (r'\bvill a\b', 'villa'), (r'\bv ll a\b', 'villa'), (r'\bvi lla\b', 'villa'),
    (r'\bstrengthene d\b', 'strengthened'), (r'\bstrength ened\b', 'strengthened'),
    (r'\btalen t\b', 'talent'), (r'\btal ent\b', 'talent'),
    (r'\bsho p\b', 'shop'), (r'\bsh op\b', 'shop'),
    (r'\bbook s\b', 'books'), (r'\bbo oks\b', 'books'),
    (r'\banimal s\b', 'animals'), (r'\banim als\b', 'animals'),
    (r'\bnecessaril y\b', 'necessarily'), (r'\bnecessar ily\b', 'necessarily'),
    (r'\bli sten\b', 'listen'), (r'\blis ten\b', 'listen'),
    (r'\badmi re\b', 'admire'), (r'\badm ire\b', 'admire'),
    (r'\bCarr y\b', 'Carry'), (r'\bcarr y\b', 'carry'),
    (r'\bsnack s\b', 'snacks'), (r'\bsnac ks\b', 'snacks'),
    (r'\bChines e\b', 'Chinese'), (r'\bChin ese\b', 'Chinese'),
    (r'\bstranger s\b', 'strangers'), (r'\bstrang ers\b', 'strangers'),
    (r'\bBefore\b', 'Before'), (r'\bBefor e\b', 'Before'),
    (r'\bmovie s\b', 'movies'), (r'\bmov ies\b', 'movies'),
    (r'\bbuildin g\b', 'building'), (r'\bbui lding\b', 'building'), (r'\bbui ldin g\b', 'building'),
    (r'\bstar in g\b', 'starting'), (r'\bstar ting\b', 'starting'), (r'\bstart ing\b', 'starting'),
    (r'\bpermi t\b', 'permit'), (r'\bpermit ted\b', 'permitted'), (r'\bpermitte d\b', 'permitted'),
    (r"\bit s\b", "it's"),  # "it s" → "it's"
    (r'\bdon\' t\b', "don't"),
    (r'\bdislik e\b', 'dislike'), (r'\bdis like\b', 'dislike'),
    (r'\bWher e\b', 'Where'), (r'\bWhe re\b', 'Where'),
    (r'\bstorie s\b', 'stories'), (r'\bsto ries\b', 'stories'),
    (r'\bchoos e\b', 'choose'), (r'\bcho ose\b', 'choose'),
    (r'\bge t\b', 'get'), (r'\bg et\b', 'get'),
    (r'\bwa y\b', 'way'), (r'\bw ay\b', 'way'),
    (r'\bpape r\b', 'paper'), (r'\bpap er\b', 'paper'),
    (r'\btoo k\b', 'took'), (r'\bt ook\b', 'took'),
    (r'\bsa w\b', 'saw'), (r'\bs aw\b', 'saw'),
    (r'\bgoo d\b', 'good'), (r'\bg ood\b', 'good'),
    (r'\bexplai n\b', 'explain'), (r'\bex plain\b', 'explain'), (r'\bexpl ain\b', 'explain'),
    (r'\bplanne d\b', 'planned'), (r'\bplan ned\b', 'planned'),
    (r'\bpresentl y\b', 'presently'),
    (r'\bimpor tant\b', 'important'), (r'\bimportan t\b', 'important'),
    (r'\bIf el\b', 'I feel'), (r'\bl li ve\b', 'I live'), (r'\bl am\b', 'I am'),
    (r'\bl prefer\b', 'I prefer'), (r'\bl think\b', 'I think'),
    (r'\bhealthy\b', 'healthy'), (r'\bhealth y\b', 'healthy'),
    (r'\btaller\b', 'taller'), (r'\btall er\b', 'taller'),
    # 更多具体词
    (r'\bgoin g\b', 'going'), (r'\bgo ing\b', 'going'),
    (r'\bus e\b', 'use'), (r'\bu se\b', 'use'),
    (r'\bimpor tan t\b', 'important'),
    (r'\bf om\b', 'from'), (r'\bfr om\b', 'from'),
    (r'\bma p\b', 'map'), (r'\bm ap\b', 'map'),
    (r'\bpic k\b', 'pick'), (r'\bp ick\b', 'pick'),
    (r'\bon e\b', 'one'), (r'\bo ne\b', 'one'),
    (r'\bonlin e\b', 'online'),
    (r'\bpossibl e\b', 'possible'), (r'\bposs ible\b', 'possible'),
    (r'\bschool s\b', 'schools'), (r'\bschoo ls\b', 'schools'),
    (r'\bther e\b', 'there'), (r'\bt here\b', 'there'),
    (r'\bvoic e\b', 'voice'), (r'\bvo ice\b', 'voice'),
    (r'\bWor ld\b', 'World'), (r'\bWo rld\b', 'World'),
    (r'\bworld\b', 'world'), (r'\bwor ld\b', 'world'),
    (r'\brepair s\b', 'repairs'), (r'\bretur ns\b', 'returns'), (r'\breturn s\b', 'returns'),
    (r'\bschool\b', 'school'),
    (r'\bf mily\b', 'family'),
    (r'\btalkin g\b', 'talking'), (r'\btalk ing\b', 'talking'),
    (r'\btall k\b', 'talk'), (r'\btal lk\b', 'talk'),
    (r'\bstran ger\b', 'stranger'), (r'\bstr anger\b', 'stranger'),
    (r'\bexcite d\b', 'excited'), (r'\bex cited\b', 'excited'),
    (r'\bsomeon e\b', 'someone'), (r'\bsome one\b', 'someone'),
    (r'\beveryon e\b', 'everyone'), (r'\bevery one\b', 'everyone'),
    (r'\beverythin g\b', 'everything'), (r'\bever ything\b', 'everything'),
    (r'\banythin g\b', 'anything'), (r'\bany thing\b', 'anything'),
    (r'\bnothin g\b', 'nothing'), (r'\bnoth ing\b', 'nothing'),
    (r'\bspendin g\b', 'spending'), (r'\bspend ing\b', 'spending'),
    (r'\beatin g\b', 'eating'), (r'\beat ing\b', 'eating'),
    (r'\bdrinkin g\b', 'drinking'), (r'\bdrink ing\b', 'drinking'),
    (r'\bplayin g\b', 'playing'), (r'\bplay ing\b', 'playing'),
    (r'\bworkin g\b', 'working'), (r'\bwork ing\b', 'working'),
    (r'\bhelpful\b', 'helpful'), (r'\bhelp ful\b', 'helpful'),
    (r'\bpossible\b', 'possible'), (r'\bpossib le\b', 'possible'),
    (r'\bproud\b', 'proud'), (r'\bpro ud\b', 'proud'),
    (r'\bshould\b', 'should'), (r'\bshou ld\b', 'should'),
    (r'\binstead\b', 'instead'), (r'\binste ad\b', 'instead'),
    (r'\bsomewher e\b', 'somewhere'), (r'\bsome where\b', 'somewhere'),
    (r'\bnowaday s\b', 'nowadays'), (r'\bnow adays\b', 'nowadays'),
    (r'\bcompetitiv e\b', 'competitive'),
    (r'\beffectiv e\b', 'effective'),
    (r'\bproductiv e\b', 'productive'),
    (r'\bexpensiv e\b', 'expensive'),
    (r'\bexclusiv e\b', 'exclusive'),
    (r'\binnovativ e\b', 'innovative'),
    (r'\bcreativ e\b', 'creative'),
    (r'\bpositiv e\b', 'positive'),
    (r'\bnegativ e\b', 'negative'),
    (r'\bsensitiv e\b', 'sensitive'),
    (r'\breluctant\b', 'reluctant'), (r'\breluctan t\b', 'reluctant'),
    (r'\bimportanc e\b', 'importance'),
    (r'\bconsequen ce\b', 'consequence'),
    (r'\binfluenc e\b', 'influence'),
    (r'\bexperienc e\b', 'experience'),
    (r'\bprefer ence\b', 'preference'), (r'\bpreferenc e\b', 'preference'),
    (r'\bdifferen ce\b', 'difference'),
    (r'\bappearanc e\b', 'appearance'),
    (r'\bperformanc e\b', 'performance'),
    (r'\bimportan ce\b', 'importance'),
    # 剩余修复
    (r'\bW hat\b', 'What'),  # "W hat" → "What"
    (r'\bfel t\b', 'felt'),  # "fel t" → "felt"
    (r'\bl listen\b', 'I listen'),  # "l listen" (l=I OCR error)
    (r'\bl like\b', 'I like'),  # "l like" (l=I OCR error)
    (r'\bl am\b', 'I am'),
    (r'\bl think\b', 'I think'),
    (r'\bl feel\b', 'I feel'),
    (r'\bl know\b', 'I know'),
    (r'\bl went\b', 'I went'),
    (r'\bl was\b', 'I was'),
    (r'\bl have\b', 'I have'),
    (r'\bl had\b', 'I had'),
    (r'\bl can\b', 'I can'),
    (r"(\w)'\s+([a-z])\b", r"\1'\2"),  # "word' s" → "word's", "shouldn' t" → "shouldn't"
]


def apply_fixes(text: str) -> str:
    """应用所有修复规则（先逐词修复，再整句替换）"""
    # 先做逐词修复（让严重碎片化的句子先恢复到半对状态）
    for pattern, replacement in PATTERNS:
        text = re.sub(pattern, replacement, text)

    # 清理多余空格
    text = re.sub(r' {2,}', ' ', text).strip()
    # 修复标点前空格
    text = re.sub(r'\s+([?,.])', r'\1', text)

    # 再做整句替换（此时大部分简单词已修复，能精确匹配）
    stripped = text.strip()
    if stripped in SENTENCE_FIXES:
        return SENTENCE_FIXES[stripped]

    return text


def clean_topic(topic: str) -> str:
    """清理话题名中的间距（英文+中文混合）"""
    if topic in SENTENCE_FIXES:
        return SENTENCE_FIXES[topic]

    # 分离英文和中文部分
    zh_start = next((i for i, c in enumerate(topic) if '\u4e00' <= c <= '\u9fff'), len(topic))
    en_part = topic[:zh_start].strip()
    zh_part = topic[zh_start:].strip()

    # 如果英文部分全是单字母（如 "T h a n k s"），直接合并
    tokens = en_part.split()
    if tokens and all(len(t) <= 2 for t in tokens) and len(tokens) >= 3:
        en_part = ''.join(tokens)
    else:
        en_part = apply_fixes(en_part)

    # 清理中文部分多余空格
    zh_part = re.sub(r'\s+', '', zh_part)

    result = (en_part + ' ' + zh_part).strip() if zh_part else en_part.strip()
    return re.sub(r'\s+', ' ', result).strip()


# ===== 主处理 =====
with open('./app/src/data/questions.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

fixed_count = 0

for cat in ['必考题', '保留题', '旧题']:
    for topic in data['part1'][cat]:
        orig = topic['topic']
        topic['topic'] = clean_topic(topic['topic'])
        if topic['topic'] != orig:
            fixed_count += 1

        for q in topic['questions']:
            orig_q, orig_a = q['question'], q['answer']
            q['question'] = apply_fixes(q['question'])
            q['answer'] = apply_fixes(q['answer'])
            if q['question'] != orig_q or q['answer'] != orig_a:
                fixed_count += 1

for cat in ['保留题', '旧题']:
    for card in data['part23'][cat]:
        card['titleZh'] = re.sub(r'\s+', '', card['titleZh'])
        if card['part2']:
            orig = card['part2']['prompt']
            card['part2']['prompt'] = apply_fixes(card['part2']['prompt'])
            card['part2']['cueCard'] = [apply_fixes(c) for c in card['part2']['cueCard']]
            card['part2']['sampleAnswer'] = apply_fixes(card['part2']['sampleAnswer'])
            if card['part2']['prompt'] != orig:
                fixed_count += 1
        for q in card['part3Questions']:
            orig_q = q['question']
            q['question'] = apply_fixes(q['question'])
            q['answer'] = apply_fixes(q['answer'])
            if q['question'] != orig_q:
                fixed_count += 1

print(f'修复了 {fixed_count} 处问题')

with open('./app/src/data/questions.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print('已保存。\n')

# 验证：打印所有旧题
print('=== Part 1 旧题验证 ===')
for topic in data['part1']['旧题']:
    print(f'\n【{topic["topic"]}】')
    for i, q in enumerate(topic['questions']):
        print(f'  Q{i}: {q["question"]}')
