// lunar-javascript 没有自带类型，这里只声明用到的入口，具体对象按 any 处理
declare module 'lunar-javascript' {
  const lunar: { Solar: any; Lunar: any }
  export default lunar
}
