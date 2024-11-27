import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import "dayjs/locale/ru";

dayjs.extend(LocalizedFormat);
dayjs.locale("ru");

export default dayjs;
