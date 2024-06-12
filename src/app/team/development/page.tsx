import Link from "next/link";

const team = [
  {
    name: "Султанова Светлана Юрьевна",
    position: "Вице-декан",
    email: "sysultanova@itmo.ru",
  },
  {
    name: "Серова Надежда Александровна",
    position:
      "HR — бизнес-партнёр, ответственная за приёмную кампанию факультета",
    email: "serova@itmo.ru",
  },
  {
    name: "Леонтьева Виктория Дмитриевна",
    position: "Исполнительный декан",
    email: "vleontyeva@itmo.ru",
  },
  {
    name: "Эфа Сергей Фридрихович",
    position: "Менеджер по административно-хозяйственной деятельности",
    email: "sfefa@itmo.ru",
  },
  {
    name: "Костянко Алена Александровна",
    position: "Аналитик",
    email: "kostianko@itmo.ru",
  },
  {
    name: "Ким Анастасия Абдумаликовна",
    position: "Event-менеджер",
    email: "kimaa@itmo.ru",
  },
  {
    name: "Пунченко Елизавета Викторовна",
    position: "PR-менеджер",
    email: "punchenko@itmo.ru",
  },
];

export default function Development() {
  return (
    <main className="">
      <h1>Отдел развития</h1>
      {team.map((x) => (
        <div key={x.email} className="border p-4 rounded-lg self-stretch">
          <h2>{x.name}</h2>
          <p>{x.position}</p>
          <p>
            <Link
              href={`mailto:${x.email}`}
              className="font-bold hover:underline"
            >
              {x.email}
            </Link>
          </p>
        </div>
      ))}
    </main>
  );
}
