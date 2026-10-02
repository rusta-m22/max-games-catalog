/* Localized public dialogue. The engine supplies only public names and evidence. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BotTalk=factory();})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const lines={
accuse:[
 ['Я шериф. Проверка показала: {target} — мафия. Предлагаю голосовать по проверке.','I am the sheriff. I checked {target}: mafia. Let’s vote on that result.'],
 ['Есть результат моей проверки: {target} — мафия. Я открываю роль шерифа.','My investigation found mafia: {target}. I am revealing myself as sheriff.'],
 ['Хватит догадок: как шериф сообщаю, что {target} — мафия.','Enough guessing: as sheriff, I report that {target} is mafia.'],
 ['У меня проверка на мафию: {target}. Я шериф, готов отвечать за эти слова.','I have a positive mafia check on {target}. I am the sheriff and stand by that claim.'],
 ['Город, запомните: {target} — мафия по моей проверке шерифа.','City, remember this: my sheriff check identifies {target} as mafia.'],
 ['Раскрываюсь шерифом. Результат проверки — {target} играет за мафию.','I am revealing my sheriff role. My result: {target} plays for the mafia.']
],
clear:[
 ['Я шериф. По моей проверке {target} — не мафия. Это ещё не исключает маньяка.','I am the sheriff. My check says {target} is not mafia. It does not rule out a maniac.'],
 ['Моя проверка шерифа: {target} не относится к мафии. Ищем дальше.','My sheriff check: {target} is not mafia. Let’s keep looking.'],
 ['Открываю роль шерифа: {target} — не мафия по проверке.','I reveal myself as sheriff: my check clears {target} of mafia affiliation.'],
 ['Как шериф могу сказать одно: проверка на мафию у {target} отрицательная.','As sheriff, I can say this: {target} tested negative for mafia.'],
 ['Делюсь проверкой шерифа. {target} не из мафии; о других ролях она не говорит.','Sharing my sheriff result: {target} is not mafia. It reveals no other role.'],
 ['Есть проверка, город: {target} — не мафия. Сообщаю как шериф.','I have a result, city: {target} is not mafia. That is my sheriff report.']
],
suspect:[
 ['Пока больше всего сомнений вызывает {target}. Хочу услышать его версию.','For now, {target} is my main suspect. I want to hear their theory.'],
 ['Мой предварительный кандидат — {target}. До голосования ещё можно меня убедить.','My tentative candidate is {target}. There is still time to change my mind.'],
 ['Предлагаю обсудить кандидатуру: {target}. Какие есть доводы за и против?','Let’s discuss {target}. What arguments support or weaken that suspicion?'],
 ['Присматриваюсь к {target}. Это подозрение, а не проверка.','I am watching {target}. This is a suspicion, not an investigation result.'],
 ['Если выбирать сейчас, мой голос получит {target}. Но я слушаю аргументы.','If we voted now, I would choose {target}. But I am listening to arguments.'],
 ['У меня в списке подозреваемых {target}. Не хочу спешить с окончательным выводом.','{target} is on my suspect list. I do not want to rush the final decision.']
],
question:[
 ['{target}, кого сейчас подозреваешь и почему?','{target}, who do you suspect, and why?'],
 ['{target}, какая версия у тебя после этой ночи?','{target}, what is your theory after this night?'],
 ['Хочу вопрос задать: {target}, на что будем опираться при голосовании?','A question for {target}: what should guide our vote?'],
 ['{target}, с чьими доводами за столом ты согласен?','{target}, whose arguments at the table do you agree with?'],
 ['Давайте дадим слово: {target}, кого стоит проверить следующим?','Let’s hear from {target}: who should be investigated next?'],
 ['{target}, есть предложение, как сузить круг подозреваемых?','{target}, any suggestion for narrowing down the suspects?']
],
caution:[
 ['Не будем всем столом повторять одну догадку. {target}, предложи свою версию.','Let’s not all repeat one guess. {target}, offer your own theory.'],
 ['Обвинение ещё не доказательство. По {target} хочется больше конкретики.','An accusation is not proof. I want more detail about {target}.'],
 ['До голосования надо сравнить версии. Кто может добавить что-то про {target}?','We should compare theories before voting. Any thoughts about {target}?'],
 ['Давайте различать проверку и подозрение. Что у нас есть по {target}?','Let’s distinguish a check from a suspicion. What do we have on {target}?'],
 ['Мафии выгодна спешка. Обсудим {target}, но выслушаем и другие варианты.','Rushing helps the mafia. Let’s discuss {target} and hear other possibilities.'],
 ['Одного имени мало для уверенного голоса. Почему именно {target}?','A name alone is not enough for a confident vote. Why {target}?']
],
defend:[
 ['{target}, подозревать меня можно, но назови причину. Давайте разберём её.','{target}, you can suspect me, but give a reason. Let’s examine it.'],
 ['Возражаю, {target}. Само обвинение не делает меня мафией.','I disagree, {target}. An accusation alone does not make me mafia.'],
 ['{target}, готов ответить на вопросы. Только без голосования наугад.','{target}, I am ready for questions. Let’s avoid a random vote.'],
 ['Мою кандидатуру обсуждаем? Хорошо. {target}, какой у тебя главный довод?','We are discussing me? Fine. {target}, what is your strongest argument?'],
 ['{target}, меня пока не убедили доводы против меня. Сравним их с другими версиями.','{target}, the case against me is not convincing. Let’s compare alternatives.'],
 ['Не согласен с выводом, {target}. Предлагаю проверить основания обвинения.','I disagree with that conclusion, {target}. Let’s examine its basis.']
],
agree:[
 ['Про {target} уже заговорили. Я тоже считаю, что эту версию стоит разобрать.','Others have mentioned {target}. I think we should examine that theory too.'],
 ['Поддерживаю обсуждение {target}, но хочу услышать ответ на подозрения.','I support discussing {target}, but want to hear their response.'],
 ['В версии про {target} может быть смысл. Какие есть возражения?','The theory about {target} may have merit. Any objections?'],
 ['Вопросы к {target} есть не только у меня. Давайте дадим ответить.','I am not the only one with questions for {target}. Let’s let them answer.'],
 ['Кандидатура {target} заслуживает внимания. Не считаю вопрос закрытым.','{target} deserves a closer look. I do not consider the matter settled.'],
 ['Соглашусь, что {target} стоит обсудить. А голос решу после ответов.','I agree that we should discuss {target}. I will decide after the answers.']
],
challenge:[
 ['Все смотрят на {target}. А если мафия просто подхватила удобное обвинение?','Everyone is looking at {target}. Could mafia be following a convenient accusation?'],
 ['Версия про {target} звучала. Что нового её подтверждает?','We have heard the theory about {target}. What new evidence supports it?'],
 ['Не хочу голосовать за {target} только потому, что это имя повторяют.','I do not want to vote for {target} just because the name keeps coming up.'],
 ['Альтернативы есть? Обсуждение {target} не должно закрывать остальные версии.','Any alternatives? Discussing {target} should not end other lines of inquiry.'],
 ['Обвинение в адрес {target} надо проверить на прочность. Какие слабые места?','Let’s test the accusation against {target}. Where is it weak?'],
 ['Прежде чем соглашаться насчёт {target}, хочу услышать противоположную сторону.','Before agreeing about {target}, I want to hear the other side.']
],
voteAsk:[
 ['{target}, в прошлом голосовании твой голос был за {subject}, а там оказался мирный. Почему?','{target}, you voted for {subject}, who turned out to be town. Why?'],
 ['Вернёмся к голосам: {target} выбрал {subject}. Исключили мирного — стоит обсудить доводы.','Back to the votes: {target} chose {subject}. We eliminated a town player; let’s discuss why.'],
 ['{target}, после открытой роли {subject} твоя версия изменилась? Ты голосовал против него.','{target}, has your theory changed since {subject} was revealed? You voted against them.'],
 ['В протоколе {target} → {subject}. После раскрытия мирной роли нужны объяснения.','The record says {target} → {subject}. With town revealed, we need an explanation.'],
 ['Не называю это доказательством, но {target} голосовал за мирного {subject}. Разберём причины.','It is not proof, but {target} voted for town player {subject}. Let’s discuss the reasons.'],
 ['{target}, помоги понять прошлый выбор: голос за {subject} привёл к выбыванию мирного.','{target}, help us understand your last choice: voting for {subject} eliminated town.']
],
voteClear:[
 ['{target} голосовал за {subject}, а там была мафия. Это довод в его пользу.','{target} voted for {subject}, who was mafia. That counts in their favor.'],
 ['В пользу {target}: голос против раскрытой мафии {subject}. Хотя алиби не абсолютное.','In favor of {target}: a vote against revealed mafia {subject}. It is not an absolute alibi.'],
 ['Не забудем, что {target} помог голосом исключить {subject} из мафии.','Remember that {target} helped vote out mafia player {subject}.'],
 ['После голосования против {subject} у {target} есть плюс доверия: исключили мафию.','{target} earns some trust for voting against {subject}: we eliminated mafia.'],
 ['По открытым голосам {target} выбрал мафиози {subject}. Держу это в уме.','The public record shows {target} voted for mafia player {subject}. I am keeping that in mind.'],
 ['{target} был среди голосовавших против мафии {subject}. Полезная деталь для обсуждения.','{target} was among those who voted against mafia player {subject}. A useful detail.']
],
regret:[
 ['Мой голос за {subject} оказался ошибкой: роль была мирная. Нужно пересмотреть версию.','My vote for {subject} was a mistake: they were town. I need to rethink my theory.'],
 ['Признаю ошибку в прошлом голосовании: я тоже выбрал {subject}. Давайте разбирать заново.','I admit my last voting mistake: I chose {subject} too. Let’s reconsider.'],
 ['После мирной роли {subject} не хочу повторять прошлый выбор без аргументов.','After {subject} turned out to be town, I do not want another vote without arguments.'],
 ['Я голосовал против {subject}. Теперь вижу, что подвёл город. Ищем новые доводы.','I voted against {subject}. I see I let the city down. Let’s look for new arguments.'],
 ['Прошлый голос за {subject} не оправдался. Не буду держаться за старую догадку.','My last vote for {subject} was wrong. I will not cling to that old guess.'],
 ['Мой выбор {subject} стоил городу мирного. Сегодня хочу подробнее выслушать всех.','My choice of {subject} cost the city a town player. Today I want to hear everyone out.']
],
reply:[
 ['{target}, вижу, что ты обращаешься ко мне. Какой у тебя главный вопрос?','{target}, I see you are addressing me. What is your main question?'],
 ['Слушаю, {target}. Давай по одному доводу, чтобы все успели разобраться.','I am listening, {target}. One argument at a time so everyone can follow.'],
 ['{target}, давай сопоставим твою версию с открытыми голосами и проверками.','{target}, let’s compare your theory with the public votes and reports.'],
 ['{target}, я здесь. Предлагаю сначала разобрать то, что известно всему столу.','{target}, I am here. Let’s start with what the whole table knows.'],
 ['Прочитал обращение, {target}. Какие факты считаешь самыми важными?','I saw your message, {target}. Which facts do you consider most important?'],
 ['{target}, готов обсуждать. С кого начнём разбор подозрений?','{target}, ready to discuss. Whose case should we examine first?']
]
};
function text(data,lang,name){const variants=lines[data.kind];if(!variants)return '';const pair=variants[Math.abs(data.variant||0)%variants.length];return pair[lang==='en'?1:0].replace(/\{(target|subject)\}/g,(_,k)=>name(data[k]));}
return {text,lines};
});
